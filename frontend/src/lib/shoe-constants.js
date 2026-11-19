export const SHOE_SIZES = ['38', '39', '40', '41', '42', '43']

export function isShoeProduct(product, categoryName = '') {
  if (product?.is_shoe === true) return true
  const cat = String(categoryName || product?.category || product?.category_name || '').toLowerCase()
  const name = String(product?.name || '').toLowerCase()
  const combined = `${cat} ${name}`
  return /sepatu|footwear|alas kaki/.test(combined)
}
