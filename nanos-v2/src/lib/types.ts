export interface ProductColor {
  name: string;
  hex: string;
  image?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  tag: string | null;
  price: number;
  oldPrice: number | null;
  description: string;
  rating: number;
  reviews: number;
  hero: string;
  isSale: boolean;
  colors: ProductColor[];
  sizes: string[];
  gallery: string[];
}

export interface AdminProduct {
  id: string;
  sku: string;
  name: string;
  slug: string;
  category: string;
  tag?: string | null;
  price: number;
  oldPrice?: number | null;
  isSale?: boolean;
  description: string | null;
  hero: string | null;
  gallery: string[];
  sizes: string[];
  colors: ProductColor[];
  stockLevel?: { quantity: number };
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItemSummary {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  product: { id: string; name: string; hero: string };
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  shippingFee: number;
  createdAt: string;
  orderItems: OrderItemSummary[];
}
