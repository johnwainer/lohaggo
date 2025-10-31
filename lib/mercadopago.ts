import { MercadoPagoConfig, Preference, Payment, Customer, CardToken, CustomerCard } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
})

export const mercadopago = {
  client,
  preference: new Preference(client),
  payment: new Payment(client),
  customer: new Customer(client),
  cardToken: new CardToken(client),
  customerCard: new CustomerCard(client),
}

export default mercadopago