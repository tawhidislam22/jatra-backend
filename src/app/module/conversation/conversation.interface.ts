export interface ICreateMessage {
  content: string;
}

export interface ICreateConversation {
  participant2Id: string;
  centerId?: string;
  rentalBookingId?: string;
  serviceRequestId?: string;
  initialMessage?: string;
}
