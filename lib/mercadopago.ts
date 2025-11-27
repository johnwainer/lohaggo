import { MercadoPagoConfig } from 'mercadopago'
import { env } from './env'

const client = new MercadoPagoConfig({
  accessToken: env.MERCADOPAGO_ACCESS_TOKEN || '',
})

export default client