export const brl = (n: number): string =>
  Number(n).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export const getProductImages = (p: { image?: string; images?: string[] }): string[] => {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images.filter(Boolean);
  if (p.image) return [p.image];
  return [];
};

export const firstProductImage = (p: { image?: string; images?: string[] }): string | undefined => {
  const imgs = getProductImages(p);
  return imgs[0];
};
