
export type OrderStatus = 'חדש' | 'מדידות' | 'בתפירה' | 'מדידה_שנייה' | 'מוכן';
export type UserRole = 'super_admin' | 'admin' | 'staff' | 'viewer';

export interface User {
  id: string;
  username: string;
  password?: string; // Stored as plain text for this simplified implementation
  role: UserRole;
  permissions: string[]; 
  createdAt?: number;
}

export interface Measurements {
  chest?: number;
  waist?: number;
  hips?: number;
  shoulderToShoulder?: number;
  sleeveLength?: number;
  totalLength?: number;
  neck?: number;
  inseam?: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  measurements: Measurements;
  notes: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  createdAt: number;
  deadline: string;
  status: 'פעיל' | 'סגור';
  isPaid: boolean;
  isDelivered: boolean;
  isArchived: boolean;
}

export interface Order {
  id: string;
  displayId: string;
  folderId: string;
  clientId: string;
  clientName: string;
  itemType: string;
  description: string;
  status: OrderStatus;
  deadline: string;
  price: number;
  deposit: number;
  fabricNotes: string;
  createdAt: number;
  updatedAt: number; // The timestamp of the last modification
  readyAt?: number; // The timestamp when the order was marked as "מוכן"
}

export interface Fabric {
  id: string;
  name: string;
  color: string;
  type: string;
  quantity: number;
  unitPrice: number;
  image?: string;
}
