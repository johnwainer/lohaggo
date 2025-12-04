# LoHaggo - Service Marketplace Platform

**Lo necesitas, LoHaggo.** - The simplest way to find any service. A modern and secure platform for requesting services with dashboards for clients, partners, and administrators.

## 🚀 Key Features

### Service System
- **50+ Services** organized in 10 categories
- **Request System**: Clients post requests and partners send proposals
- **Photo Upload**: Clients can attach up to 5 photos to their requests
- **Search and Filters**: Search by name, category, and sort by popularity/price
- **City-Based Services**: Services filtered by city with geolocation support
- **Direct Partner Requests**: Request services directly from specific partners
- **Favorite Partners**: Save favorite partners for quick access

### User System
- **3 User Types**: Clients, Partners (Providers), and Administrators
- **Secure Authentication** with NextAuth.js and bcrypt
- **Complete Profiles**: Detailed information for clients and partners
- **Address Management**: Clients can save multiple addresses
- **Partner Verification**: Document system with administrative validation
- **Verification Badges**: ID, Education, and Background check badges

### Payment System
- **Mercado Pago Integration**: Secure payment processing
- **Frozen Commissions**: Rates are saved when accepting the service
- **Automatic Payouts**: Automatic payment distribution to partners
- **Admin Panel**: Complete control of commissions, payments, and payouts
- **Payment Methods**: Saved card management with Mercado Pago
- **Secure Transactions**: PCI-compliant payment processing

### Communication System
- **Real-Time Chat**: Direct communication between clients and partners
- **Modal Messaging**: Integrated chat in "My Requests" and "My Bookings"
- **Content Validation**: Prevention of contact information exchange
- **Auto Polling**: Message updates every 3 seconds
- **Unread Counters**: Visual indicators for unread messages

### Rating System
- **Bidirectional Ratings**: Clients rate partners and vice versa
- **Star System**: 1 to 5 star ratings
- **Optional Comments**: Detailed feedback about the service
- **Rating History**: View all received ratings
- **Average Display**: Rating average visible on profiles

### Notification System
- **Push Notifications**: Instant alerts with Web Push API
- **VAPID Validation**: Keys validated on startup with scheduled rotation
- **Multiple Types**: New proposal, proposal accepted, payment received, etc.
- **Unread Badge**: Visual counter for pending notifications
- **Complete History**: Access to all historical notifications
- **Auto-cleanup**: Expired subscriptions are automatically removed

### Security and Validation
- **Centralized Error Handling**: Robust system with custom error classes
- **Zod Validation**: Validation schemas for all critical inputs
- **Structured Logging**: Pino logging system for monitoring and debugging
- **Data Sanitization**: Automatic cleaning of dangerous inputs
- **Credential Protection**: Secure management of Cloudinary and VAPID keys
- **Rate Limiting**: Protection against API abuse
- **CSRF Protection**: Security tokens in critical forms

### Design and UX
- **Modern Design** inspired by Uber and Rappi
- **Responsive**: Works perfectly on mobile, tablets, and desktop
- **Intuitive Interface**: Clear and simple navigation
- **Visual Feedback**: Loading states, confirmations, and clear errors
- **PWA Ready**: Progressive Web App capabilities

## 🛠️ Technologies

### Core
- **Next.js 14** (App Router)
- **TypeScript**
- **React 18**

### Database
- **Prisma** (ORM)
- **PostgreSQL** (Database)
- **Supabase** (Production database)

### Authentication and Security
- **NextAuth.js** (Authentication)
- **bcrypt** (Password hashing)
- **Zod** (Schema validation)
- **Pino** (Structured logging)

### Payments and External Services
- **Mercado Pago** (Payment processing)
- **Cloudinary** (Image storage)
- **Web Push API** (Push notifications)

### UI/UX
- **Tailwind CSS** (Styling)
- **Lucide React** (Icons)
- **Radix UI** (Accessible components)

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL installed (for local development) or Supabase account
- Cloudinary account (for photo uploads)
- Mercado Pago account (for payment processing)
- npm or yarn

## 🔧 Local Installation

1. **Clone the repository**

```bash
git clone <your-repository>
cd lohaggo
npm install
```

2. **Configure environment variables**

Create a `.env.local` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lohaggo_db"

# NextAuth
NEXTAUTH_SECRET="your-super-secure-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Cloudinary (for photo uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="your-access-token"
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="your-public-key"

# Push Notifications
# Generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
```

3. **Configure the database**

```bash
# Apply migrations
npx prisma migrate deploy

# Seed with initial data
npx prisma db seed
```

4. **Start the development server**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🚀 Production Deploy (Supabase + Vercel)

### 1. Configure Database (Supabase)

1. Create a project on [Supabase](https://supabase.com)
2. Go to Settings → Database → Connection String
3. Copy the **Connection String** (Transaction mode)
4. Run migrations with Prisma

### 2. Configure Cloudinary

1. Create an account on [Cloudinary](https://cloudinary.com)
2. Go to Dashboard and copy:
   - Cloud Name
   - API Key
   - API Secret

### 3. Configure Mercado Pago

1. Create an account on [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Go to Your integrations → Create application
3. Copy production credentials:
   - Access Token
   - Public Key

### 4. Generate VAPID Keys for Push Notifications

```bash
npx web-push generate-vapid-keys
```

Save the generated keys to configure them in Vercel.

### 5. Configure Environment Variables in Vercel

Go to your project in Vercel → Settings → Environment Variables and add:

```
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]/[DATABASE]?sslmode=require
NEXTAUTH_SECRET=your-super-secure-secret-here
NEXTAUTH_URL=https://your-domain.vercel.app
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
MERCADOPAGO_ACCESS_TOKEN=your-access-token
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your-public-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

**Important**: Check all 3 options (Production, Preview, Development) for each variable.

### 6. Deploy

```bash
git push origin main
```

Vercel will deploy automatically.

## 📱 Application Structure

### Public Pages
- `/` - Home page with categories and popular services
- `/servicios` - Complete service catalog with search and filters
- `/servicios/[slug]` - Service detail with request form and partner list
- `/ciudad/[slug]` - City-specific services and information
- `/login` - Login
- `/register` - New user registration

### Private Dashboards

#### Client (`/dashboard`)
- **My Requests**: View active requests and received proposals
- **My Bookings**: Manage contracted services
- **Favorites**: Quick access to favorite partners
- **Chat**: Communication with partners (integrated modal)
- **Ratings**: Rate completed services
- **Addresses**: Manage saved addresses
- **Payment Methods**: Manage saved cards
- **Notifications**: View all notifications

#### Partner (`/partner`)
- **Available Requests**: View and respond to client requests
- **My Proposals**: Track sent proposals
- **My Bookings**: Manage contracted services
- **Chat**: Communication with clients (integrated modal)
- **Ratings**: Rate clients
- **Verification**: Upload documents for verification
- **Statistics**: Income, completed services, average rating
- **Notifications**: View all notifications

#### Administrator (`/admin`)
- **Dashboard**: General platform statistics
- **Commissions**: Configure client and partner rates
- **Payments**: View all processed payments
- **Payouts**: Manage payments to partners
- **Users**: Manage clients and partners
- **Services**: Manage service catalog
- **Cities**: Manage available cities
- **Verification**: Approve/reject partner documents

## 💰 Payment and Commission System

### Payment Flow

1. **Client accepts proposal** → Booking is created with current frozen rates
2. **Client makes payment** → Processed with Mercado Pago
3. **Payment confirmed** → Payout is automatically created for partner
4. **Partner receives payment** → Net amount (after commission) is transferred

### Frozen Commissions

Commission rates are saved when the proposal is accepted:
- **Client**: 5% by default (configurable from `/admin`)
- **Partner**: 20% by default (configurable from `/admin`)

**Important**: Rate changes do NOT affect already contracted services.

## 💬 Chat System

### Features
- **Integrated Modal**: Chat without leaving current page
- **Real-Time**: Polling every 3 seconds for new messages
- **Validation**: Prevention of phone, email, WhatsApp exchange
- **System Messages**: Automatic alerts about restrictions
- **Auto Scroll**: Always shows the latest message
- **Read Marking**: Messages are automatically marked as read

## ⭐ Rating System

### Features
- **Bidirectional**: Client rates partner and vice versa
- **Stars**: 1 to 5 star system
- **Comments**: Optional detailed feedback
- **Once per service**: Can only rate after completing the service
- **Visible Average**: Average rating visible on profiles

## 🔔 Notification System

### Notification Types

#### For Clients
- New proposal received
- Proposal accepted
- Payment processed successfully
- Service completed
- Partner rated you

#### For Partners
- New request available
- Proposal accepted by client
- Payment received
- New payout available
- Client rated you

## 🏙️ City System

### Features
- **Multi-City Support**: Services available in multiple cities
- **Geolocation**: Automatic city detection based on user location
- **City Pages**: Dedicated pages for each city with local services
- **City Filtering**: Filter services and partners by city
- **City Management**: Admin panel for managing available cities

## ⭐ Favorite Partners

### Features
- **Save Favorites**: Mark partners as favorites for quick access
- **Favorites Dashboard**: Dedicated tab in client dashboard
- **Quick Requests**: Request services directly from favorite partners
- **Partner Details**: View partner services and verification status
- **Easy Management**: Add/remove favorites with one click

## 🔒 Security Best Practices

- Never commit `.env` files
- Rotate credentials regularly
- Use strong passwords for production
- Enable 2FA on all service accounts
- Monitor logs for suspicious activity
- Keep dependencies updated
- Use HTTPS in production

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. Contact the repository owner for contribution guidelines.
