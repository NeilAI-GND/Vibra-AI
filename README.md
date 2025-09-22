# Vibra AI - Image Generation Application

A powerful no-code image generation platform that transforms user-uploaded images using AI-powered preset prompts with intelligent quota management.

## 🚀 Features

- **Smart Image Upload**: Support for JPG, PNG, WEBP formats with automatic validation
- **Preset Prompt System**: Hard-coded, backend-controlled prompts for consistent results
- **AI-Powered Generation**: Integration with OpenAI DALL-E for high-quality image generation
- **User Tier Management**: Free and paid tiers with quota enforcement
- **Refinement System**: Post-generation customization options
- **Modern UI**: Responsive React interface with Tailwind CSS
- **Secure Authentication**: JWT-based user authentication and session management

## 🏗️ Architecture

```
Frontend (React + Tailwind) ↔ Backend (Node.js + Express) ↔ Database (MongoDB) ↔ AI Service (OpenAI)
```

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- MongoDB (local or cloud instance)
- OpenAI API key

## 🛠️ Installation

1. **Clone and setup the project:**
   ```bash
   cd "Vibra AI"
   npm run install-all
   ```

2. **Configure environment variables:**
   
   Backend (.env):
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/vibra-ai
   JWT_SECRET=your-super-secret-jwt-key
   OPENAI_API_KEY=your-openai-api-key
   NODE_ENV=development
   ```

   Frontend (.env):
   ```
   REACT_APP_API_URL=http://localhost:5000/api
   ```

3. **Start the development servers:**
   ```bash
   npm run dev
   ```

## 🎯 Usage

1. **Register/Login**: Create an account or sign in
2. **Upload Image**: Select and upload your image (max 10MB)
3. **Choose Preset**: Select from available preset prompts
4. **Generate**: Wait for AI processing (typically 30-60 seconds)
5. **Refine** (Optional): Add style, background, or theme modifications
6. **Download**: Save your generated image

## 📁 Project Structure

```
vibra-ai/
├── backend/                 # Node.js Express API
│   ├── controllers/         # Route controllers
│   ├── middleware/          # Custom middleware
│   ├── models/             # MongoDB models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   └── server.js           # Entry point
├── frontend/               # React application
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── utils/          # Utility functions
│   │   └── App.js          # Main app component
├── uploads/                # Image storage
├── TRD.md                  # Technical Requirements
└── README.md               # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Image Generation
- `POST /api/generate` - Upload and generate image
- `GET /api/generate/:id` - Get generation status
- `POST /api/refine/:id` - Refine existing generation

### User Management
- `GET /api/user/profile` - User profile
- `GET /api/user/quota` - Quota status
- `GET /api/user/history` - Generation history

## 🎨 Preset Prompts

1. **Portrait Enhancement**: Professional headshot transformation
2. **Artistic Style**: Vibrant artistic painting conversion
3. **Fantasy Theme**: Magical fantasy scene creation
4. **Vintage Style**: Classic, timeless styling
5. **Modern Minimalist**: Clean, contemporary design

## 💳 User Tiers

- **Free Tier**: 5 generations per day
- **Paid Tier**: 50 generations per day

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Input validation and sanitization
- File upload security checks
- Rate limiting
- CORS protection

## 🚀 Deployment

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Set production environment variables**

3. **Deploy to your preferred platform:**
   - Heroku
   - Vercel
   - AWS
   - DigitalOcean

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the TRD.md for technical details

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
  - Image upload and generation
  - User authentication
  - Quota management
  - Preset prompt system

---

**Built with ❤️ by the Vibra AI Team**