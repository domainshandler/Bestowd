/**
 * Built-in suggestions per field, used after the group's own history and what's popular across Bestowd.
 * Extend freely: one value per entry, as people would type it.
 */
export const SEED: Record<'title' | 'brand' | 'store' | 'category', string[]> = {
  brand: [
    'Adidas', 'Amazon', 'Apple', 'Barbie', 'Beats', 'Bose', 'Brio', 'Calvin Klein', 'Canon', 'Carter\'s', 'Casio', 'Chanel', 'Coach',
    'Columbia', 'Converse', 'Crayola', 'Crocs', 'Dior', 'Disney', 'Dyson', 'Fisher-Price', 'Fitbit', 'Fossil', 'Fujifilm', 'Funko',
    'Garmin', 'Gap', 'GoPro', 'Gucci', 'Hasbro', 'Hatchimals', 'Hot Wheels', 'Hydro Flask', 'IKEA', 'Instax', 'JBL', 'Jellycat',
    'KitchenAid', 'Kindle', 'L.O.L. Surprise!', 'Lacoste', 'Le Creuset', 'Lego', 'Levi\'s', 'Logitech', 'Lululemon', 'L\'Occitane',
    'Magna-Tiles', 'Mattel', 'Melissa & Doug', 'Michael Kors', 'Microsoft', 'Moleskine', 'Nerf', 'Nespresso', 'New Balance',
    'Nike', 'Nintendo', 'Ninja', 'Oral-B', 'Pandora', 'Patagonia', 'Philips', 'Playmobil', 'Pokémon', 'PlayStation', 'Puma',
    'Ralph Lauren', 'Ray-Ban', 'Roots', 'Samsung', 'Sephora', 'Skip Hop', 'Sony', 'Squishmallows', 'Stanley', 'Starbucks',
    'Swarovski', 'Ted Baker', 'The North Face', 'Timberland', 'Tommy Hilfiger', 'Tonies', 'Tupperware', 'Under Armour', 'Vans',
    'VTech', 'Xbox', 'Yeti', 'Yoto', 'Zara',
  ],
  store: [
    'Amazon', 'Apple Store', 'Best Buy', 'Canadian Tire', 'Chapters', 'Costco', 'Dollarama', 'eBay', 'Etsy', 'Gap', 'H&M',
    'Home Depot', 'HomeSense', 'Hudson\'s Bay', 'IKEA', 'Indigo', 'Lululemon', 'Mastermind Toys', 'Michaels', 'Old Navy',
    'Roots', 'Sephora', 'Shoppers Drug Mart', 'Simons', 'Sport Chek', 'Staples', 'Target', 'Toys"R"Us', 'Walmart', 'Winners',
    'Zara', 'Local shop', 'Handmade',
  ],
  category: [
    'Art supplies', 'Baby gear', 'Bags', 'Bath and body', 'Board game', 'Books', 'Building toys', 'Candles', 'Clothing',
    'Craft kit', 'Dolls', 'Electronics', 'Experience', 'Flowers', 'Food and treats', 'Games', 'Gift card', 'Headphones',
    'Home decor', 'Jewellery', 'Kitchen', 'Lego', 'Makeup', 'Music', 'Outdoor', 'Perfume', 'Plush', 'Puzzle', 'Science kit',
    'Shoes', 'Smartwatch', 'Sports', 'Stationery', 'Subscription', 'Tech accessories', 'Tools', 'Toy vehicles', 'Video game',
    'Watch', 'Wine',
  ],
  title: [
    'Art easel', 'Bath bombs', 'Bluetooth speaker', 'Board game', 'Book', 'Building blocks', 'Candle set', 'Colouring book',
    'Cookie tin', 'Dinosaur figures', 'Doll house', 'Flowers', 'Gift card', 'Headphones', 'Jigsaw puzzle', 'Kids tablet',
    'Lego set', 'Lunch box', 'Mug', 'Night light', 'Pajamas', 'Perfume', 'Picture frame', 'Play-Doh set', 'Plush toy',
    'Remote-control car', 'Scarf', 'Science kit', 'Scooter', 'Smartwatch', 'Sneakers', 'Socks', 'Sweater', 'Teddy bear',
    'Tote bag', 'Toy kitchen', 'Wallet', 'Water bottle', 'Watercolour paint kit', 'Wine',
  ],
}
