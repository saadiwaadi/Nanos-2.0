export interface ProductColor {
  name: string;
  hex: string;
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
