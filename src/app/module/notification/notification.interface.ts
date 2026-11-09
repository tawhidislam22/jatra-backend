export interface ICreateNotification {
  userId: string;
  title: string;
  message: string;
  type?: string;
  link?: string;
}
