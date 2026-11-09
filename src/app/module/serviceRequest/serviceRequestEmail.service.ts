import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../../utils/email.js";
import { envVars } from "../../config/env.js";

interface EmailLogPayload {
  recipient: string;
  subject: string;
  template: string;
  dedupKey?: string;
  serviceRequestId?: string;
}

const dispatchEmailSafely = async (
  options: {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    dedupKey?: string;
    serviceRequestId?: string;
  }
) => {
  // Deduplication check: if an email with this dedupKey was already sent in the last 24h, skip
  if (options.dedupKey) {
    const existing = await prisma.emailLog.findUnique({
      where: { dedupKey: options.dedupKey }
    });
    if (existing && existing.status === "SENT") {
      console.log(`[EmailService] Skipping duplicate email: ${options.dedupKey}`);
      return;
    }
  }

  let status = "SENT";
  let errorMessage: string | null = null;

  try {
    await sendEmail({
      to: options.to,
      subject: options.subject,
      templateName: options.templateName,
      templateData: options.templateData
    });
  } catch (err: any) {
    status = "FAILED";
    errorMessage = err?.message || String(err);
    console.error(`[EmailService] Failed to send email to ${options.to}:`, errorMessage);
  }

  try {
    await prisma.emailLog.create({
      data: {
        recipient: options.to,
        subject: options.subject,
        template: options.templateName,
        status,
        error: errorMessage,
        dedupKey: options.dedupKey || null,
        serviceRequestId: options.serviceRequestId || null
      }
    });
  } catch (logErr) {
    console.error("[EmailService] Failed to create email log record:", logErr);
  }
};

export const ServiceRequestEmailService = {
  sendBookingConfirmation: async (serviceRequest: any, customer: any, center: any, vehicle: any) => {
    const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})` : "Vehicle";
    const dedupKey = `CONFIRM_${serviceRequest.id}_${customer.id}`;

    await dispatchEmailSafely({
      to: customer.email,
      subject: `Booking Confirmed: ${serviceRequest.serviceName || "Car Service"} at ${center.name}`,
      templateName: "bookingConfirmation",
      dedupKey,
      serviceRequestId: serviceRequest.id,
      templateData: {
        customerName: customer.fullName || customer.name || "Customer",
        bookingId: serviceRequest.id,
        serviceName: serviceRequest.serviceName || "Standard Workshop Service",
        vehicleInfo,
        scheduledDate: new Date(serviceRequest.scheduledDate).toLocaleString(),
        estimatedDuration: serviceRequest.estimatedDuration || 60,
        totalAmount: serviceRequest.totalAmount || 0,
        centerName: center.name,
        centerAddress: center.address,
        dashboardUrl: `${envVars.FRONTEND_URL}/dashboard/service-requests`
      }
    });
  },

  sendMechanicAssigned: async (serviceRequest: any, mechanic: any, customer: any, center: any, vehicle: any) => {
    const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})` : "Vehicle";
    const dedupKey = `ASSIGN_${serviceRequest.id}_${mechanic.id}_${Date.now()}`;

    await dispatchEmailSafely({
      to: mechanic.email,
      subject: `New Job Assigned: ${serviceRequest.serviceName || "Service"} at ${center.name}`,
      templateName: "mechanicAssigned",
      dedupKey,
      serviceRequestId: serviceRequest.id,
      templateData: {
        mechanicName: mechanic.fullName || mechanic.name || "Mechanic",
        bookingId: serviceRequest.id,
        serviceName: serviceRequest.serviceName || "Automotive Repair",
        vehicleInfo,
        customerName: customer?.fullName || customer?.name || "Client",
        customerContact: customer?.phone || customer?.email || "N/A",
        scheduledDate: new Date(serviceRequest.scheduledDate).toLocaleString(),
        estimatedDuration: serviceRequest.estimatedDuration || 60,
        issueDescription: serviceRequest.issueDescription || "",
        centerName: center.name,
        dashboardUrl: `${envVars.FRONTEND_URL}/mechanic/dashboard/assigned-services`
      }
    });
  },

  sendWorkCompletedForReview: async (serviceRequest: any, owner: any, mechanic: any, customer: any, vehicle: any) => {
    const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})` : "Vehicle";
    const dedupKey = `COMPLETED_REVIEW_${serviceRequest.id}`;

    await dispatchEmailSafely({
      to: owner.email,
      subject: `Work Completed for Review: Job #${serviceRequest.id.slice(0, 8)} (${vehicleInfo})`,
      templateName: "workCompletedReview",
      dedupKey,
      serviceRequestId: serviceRequest.id,
      templateData: {
        ownerName: owner.fullName || owner.name || "Owner",
        bookingId: serviceRequest.id,
        serviceName: serviceRequest.serviceName || "Workshop Service",
        vehicleInfo,
        mechanicName: mechanic?.fullName || mechanic?.name || "Assigned Mechanic",
        customerName: customer?.fullName || customer?.name || "Customer",
        dashboardUrl: `${envVars.FRONTEND_URL}/owner/dashboard/service-requests`
      }
    });
  },

  sendServiceApproved: async (serviceRequest: any, customer: any, center: any, vehicle: any) => {
    const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";
    const dedupKey = `APPROVED_${serviceRequest.id}`;

    await dispatchEmailSafely({
      to: customer.email,
      subject: `Service Approved: Your car is ready at ${center.name}!`,
      templateName: "serviceApproved",
      dedupKey,
      serviceRequestId: serviceRequest.id,
      templateData: {
        customerName: customer.fullName || customer.name || "Customer",
        bookingId: serviceRequest.id,
        serviceName: serviceRequest.serviceName || "Car Servicing",
        vehicleInfo,
        centerName: center.name,
        reviewUrl: `${envVars.FRONTEND_URL}/dashboard/service-requests`
      }
    });
  },

  sendReworkNotice: async (recipientEmail: string, recipientName: string, serviceRequest: any, center: any, vehicle: any, notes: string) => {
    const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";
    const dedupKey = `REWORK_${serviceRequest.id}_${Date.now()}`;

    await dispatchEmailSafely({
      to: recipientEmail,
      subject: `Service Rework Required: Job #${serviceRequest.id.slice(0, 8)} at ${center.name}`,
      templateName: "reworkRequested",
      dedupKey,
      serviceRequestId: serviceRequest.id,
      templateData: {
        recipientName,
        bookingId: serviceRequest.id,
        centerName: center.name,
        vehicleInfo,
        reworkNotes: notes,
        dashboardUrl: `${envVars.FRONTEND_URL}/dashboard/service-requests`
      }
    });
  }
};
