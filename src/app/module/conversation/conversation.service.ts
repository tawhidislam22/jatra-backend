import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { NotificationService } from "../notification/notification.service.js";

const getUserConversations = async (userId: string) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    },
    include: {
      participant1: {
        select: {
          id: true,
          name: true,
          fullName: true,
          email: true,
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
          image: true,
          role: true,
        }
      },
      center: {
        select: {
          id: true,
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
          scheduledDate: true,
          status: true,
          issueDescription: true,
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
    const isP1 = conv.participant1Id === userId;
    const otherParticipant = isP1 ? conv.participant2 : conv.participant1;
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
        select: { id: true, name: true, fullName: true, image: true, role: true }
      },
      participant2: {
        select: { id: true, name: true, fullName: true, image: true, role: true }
      },
      center: {
        select: { id: true, name: true, address: true, images: true }
      },
      rentalBooking: {
        select: {
          id: true,
          pickupDate: true,
          returnDate: true,
          totalAmount: true,
          status: true,
          vehicle: { select: { make: true, model: true } }
        }
      },
      serviceRequest: {
        select: {
          id: true,
          serviceType: true,
          scheduledDate: true,
          status: true,
          vehicle: { select: { make: true, model: true } }
        }
      }
    }
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found.");
  }

  if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
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

  const otherParticipant = conversation.participant1Id === userId 
    ? conversation.participant2 
    : conversation.participant1;

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
      participant1: { select: { id: true, name: true, fullName: true } },
      participant2: { select: { id: true, name: true, fullName: true } },
    }
  });

  if (!conversation) {
    throw new AppError(status.NOT_FOUND, "Conversation not found.");
  }

  if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
    throw new AppError(status.FORBIDDEN, "Not authorized to participate in this conversation.");
  }

  const recipientId = conversation.participant1Id === userId 
    ? conversation.participant2Id 
    : conversation.participant1Id;

  const senderUser = conversation.participant1Id === userId 
    ? conversation.participant1 
    : conversation.participant2;

  const senderName = senderUser.fullName || senderUser.name || "User";

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
      link: `/dashboard/messages?conversationId=${conversationId}`
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
