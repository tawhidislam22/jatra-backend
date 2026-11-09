import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { NotificationService } from "../notification/notification.service.js";

const getUserConversations = async (userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { participant1Id: userId },
        { participant2Id: userId },
        { center: { adminId: userId } }
      ]
    },
    include: {
      participant1: {
        select: {
          id: true,
          name: true,
          fullName: true,
          email: true,
          phone: true,
          image: true,
          role: true,
        }
      },
      participant2: {
        select: {
          id: true,
          name: true,
          fullName: true,
          email: true,
          phone: true,
          image: true,
          role: true,
        }
      },
      center: {
        select: {
          id: true,
          adminId: true,
          name: true,
          address: true,
          images: true,
          phone: true,
        }
      },
      rentalBooking: {
        select: {
          id: true,
          pickupDate: true,
          returnDate: true,
          totalAmount: true,
          status: true,
          customer: {
            select: {
              id: true,
              name: true,
              fullName: true,
              email: true,
              phone: true,
              image: true,
              role: true,
            }
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              images: true,
            }
          }
        }
      },
      serviceRequest: {
        select: {
          id: true,
          serviceType: true,
          serviceName: true,
          scheduledDate: true,
          status: true,
          issueDescription: true,
          customer: {
            select: {
              id: true,
              name: true,
              fullName: true,
              email: true,
              phone: true,
              image: true,
              role: true,
            }
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
            }
          }
        }
      },
      messages: {
        where: {
          senderId: { not: userId },
          read: false
        },
        select: { id: true }
      }
    },
    orderBy: {
      lastMessageAt: "desc"
    }
  });

  return conversations.map((conv) => {
    let otherParticipant = conv.participant1Id === userId ? conv.participant2 : conv.participant1;

    // When viewed by center admin / owner, guarantee otherParticipant resolves to the customer
    if (conv.center?.adminId === userId) {
      if (conv.serviceRequest?.customer) {
        otherParticipant = conv.serviceRequest.customer;
      } else if (conv.rentalBooking?.customer) {
        otherParticipant = conv.rentalBooking.customer;
      } else if (conv.participant1?.role === "CUSTOMER") {
        otherParticipant = conv.participant1;
      } else if (conv.participant2?.role === "CUSTOMER") {
        otherParticipant = conv.participant2;
      }
    }

    const unreadCount = conv.messages.length;

    return {
      id: conv.id,
      otherParticipant,
      center: conv.center,
      rentalBooking: conv.rentalBooking,
      serviceRequest: conv.serviceRequest,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      unreadCount
    };
  });
};

const getConversationMessages = async (userId: string, conversationId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participant1: {
        select: { id: true, name: true, fullName: true, email: true, phone: true, image: true, role: true }
      },
      participant2: {
        select: { id: true, name: true, fullName: true, email: true, phone: true, image: true, role: true }
      },
      center: {
        select: { id: true, adminId: true, name: true, address: true, images: true }
      },
      rentalBooking: {
        select: {
          id: true,
          pickupDate: true,
          returnDate: true,
          totalAmount: true,
          status: true,
          customer: {
            select: { id: true, name: true, fullName: true, email: true, phone: true, image: true, role: true }
          },
          vehicle: { select: { make: true, model: true } }
        }
      },
      serviceRequest: {
        select: {
          id: true,
          serviceType: true,
          serviceName: true,
          scheduledDate: true,
          status: true,
          customer: {
            select: { id: true, name: true, fullName: true, email: true, phone: true, image: true, role: true }
          },
          vehicle: { select: { make: true, model: true } }
        }
      }
    }
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found.");
  }

  const isP1 = conversation.participant1Id === userId;
  const isP2 = conversation.participant2Id === userId;
  const isCenterAdmin = conversation.center?.adminId === userId;

  if (!isP1 && !isP2 && !isCenterAdmin) {
    throw new AppError(status.FORBIDDEN, "Not authorized to access this conversation.");
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          fullName: true,
          image: true,
          role: true,
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  // Automatically mark unread messages as read
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      read: false
    },
    data: { read: true }
  });

  let otherParticipant = conversation.participant1Id === userId 
    ? conversation.participant2 
    : conversation.participant1;

  if (isCenterAdmin) {
    if (conversation.serviceRequest?.customer) {
      otherParticipant = conversation.serviceRequest.customer;
    } else if (conversation.rentalBooking?.customer) {
      otherParticipant = conversation.rentalBooking.customer;
    } else if (conversation.participant1?.role === "CUSTOMER") {
      otherParticipant = conversation.participant1;
    } else if (conversation.participant2?.role === "CUSTOMER") {
      otherParticipant = conversation.participant2;
    }
  }

  return {
    conversation: {
      id: conversation.id,
      otherParticipant,
      center: conversation.center,
      rentalBooking: conversation.rentalBooking,
      serviceRequest: conversation.serviceRequest,
      createdAt: conversation.createdAt,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt
    },
    messages
  };
};

const sendMessage = async (userId: string, conversationId: string, content: string) => {
  if (!content || !content.trim()) {
    throw new AppError(status.BAD_REQUEST, "Message content cannot be empty.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participant1: { select: { id: true, name: true, fullName: true, role: true } },
      participant2: { select: { id: true, name: true, fullName: true, role: true } },
      center: { select: { id: true, adminId: true, name: true } },
    }
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found.");
  }

  const isP1 = conversation.participant1Id === userId;
  const isP2 = conversation.participant2Id === userId;
  const isCenterAdmin = conversation.center?.adminId === userId;

  if (!isP1 && !isP2 && !isCenterAdmin) {
    throw new AppError(status.FORBIDDEN, "Not authorized to participate in this conversation.");
  }

  const recipientId = isP1 
    ? conversation.participant2Id 
    : isP2 
    ? conversation.participant1Id 
    : conversation.participant1Id;

  const senderUser = isP1 
    ? conversation.participant1 
    : isP2 
    ? conversation.participant2 
    : { fullName: "Service Center Admin", name: conversation.center?.name || "Center Admin" };

  const senderName = senderUser.fullName || senderUser.name || "User";

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, role: true }
  });

  const messageLink = recipient?.role === "OWNER"
    ? `/owner/dashboard/messages?conversationId=${conversationId}`
    : recipient?.role === "MECHANIC"
    ? `/mechanic/dashboard/messages?conversationId=${conversationId}`
    : `/dashboard/messages?conversationId=${conversationId}`;

  const [newMessage] = await Promise.all([
    prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
        read: false
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            fullName: true,
            image: true,
            role: true,
          }
        }
      }
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.trim(),
        lastMessageAt: new Date(),
      }
    }),
    NotificationService.createNotification({
      userId: recipientId,
      title: `New message from ${senderName}`,
      message: content.trim().length > 60 ? `${content.trim().slice(0, 60)}...` : content.trim(),
      type: "MESSAGE",
      link: messageLink
    })
  ]);

  return newMessage;
};

const markConversationAsRead = async (userId: string, conversationId: string) => {
  return await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      read: false
    },
    data: { read: true }
  });
};

const createOrGetBookingConversation = async (
  customerId: string,
  ownerId: string,
  centerId?: string,
  rentalBookingId?: string,
  vehicleName?: string,
  pickupDate?: Date,
  returnDate?: Date
) => {
  try {
    // If customer and owner are the same person, skip
    if (customerId === ownerId) return null;

    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: customerId, participant2Id: ownerId },
          { participant1Id: ownerId, participant2Id: customerId }
        ],
        ...(centerId ? { centerId } : {})
      }
    });

    const pickupStr = pickupDate ? new Date(pickupDate).toLocaleDateString() : "the scheduled date";
    const returnStr = returnDate ? new Date(returnDate).toLocaleDateString() : "the return date";
    const initialContent = `Hi! I have placed a rental booking for ${vehicleName || "a vehicle"} from ${pickupStr} to ${returnStr}. Looking forward to the trip!`;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: customerId,
          participant2Id: ownerId,
          centerId: centerId || null,
          rentalBookingId: rentalBookingId || null,
          lastMessage: initialContent,
          lastMessageAt: new Date(),
          messages: {
            create: {
              senderId: customerId,
              content: initialContent,
              read: false,
            }
          }
        }
      });
    } else {
      // Post booking notification message in existing thread
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: customerId,
          content: initialContent,
          read: false
        }
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          rentalBookingId: rentalBookingId || conversation.rentalBookingId,
          lastMessage: initialContent,
          lastMessageAt: new Date(),
        }
      });
    }

    return conversation;
  } catch (error) {
    console.error("Error creating booking conversation:", error);
    return null;
  }
};

const createOrGetServiceConversation = async (
  customerId: string,
  ownerId: string,
  centerId: string,
  serviceRequestId: string,
  serviceType: string,
  issueDescription: string,
  scheduledDate?: Date
) => {
  try {
    if (customerId === ownerId) return null;

    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1Id: customerId, participant2Id: ownerId },
          { participant1Id: ownerId, participant2Id: customerId }
        ],
        centerId
      }
    });

    const dateStr = scheduledDate ? new Date(scheduledDate).toLocaleDateString() : "the scheduled date";
    const initialContent = `Hello! I have requested a ${serviceType || "Workshop"} service appointment scheduled on ${dateStr}. Details: ${issueDescription || "General inspection"}.`;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participant1Id: customerId,
          participant2Id: ownerId,
          centerId,
          serviceRequestId,
          lastMessage: initialContent,
          lastMessageAt: new Date(),
          messages: {
            create: {
              senderId: customerId,
              content: initialContent,
              read: false,
            }
          }
        }
      });
    } else {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: customerId,
          content: initialContent,
          read: false
        }
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          serviceRequestId,
          lastMessage: initialContent,
          lastMessageAt: new Date(),
        }
      });
    }

    return conversation;
  } catch (error) {
    console.error("Error creating service conversation:", error);
    return null;
  }
};

export const ConversationService = {
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
  createOrGetBookingConversation,
  createOrGetServiceConversation,
};
