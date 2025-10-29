# Quiz System - 100 Questions Across 4 Subjects

A comprehensive quiz application with 100 questions covering DBMS, Front-End Development Frameworks, Object-Oriented Programming, and Operating Systems.

## 🎯 Features

- **100 Questions**: 25 questions each from 4 subjects (DBMS, FEDF, OOP, OS)
- **Multiple Choice**: 4 options per question with instant feedback
- **Timer System**: 60-minute time limit with automatic submission
- **Student Dashboard**: Track attempts, scores, and time spent
- **Teacher Dashboard**: View all student attempts, add/delete questions
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Scoring**: Immediate feedback on quiz completion

## 🚀 Live Demo

- **Frontend**: https://quiz-app-f2d9e.web.app
- **Backend**: (Deploy to Render - see deployment guide)

## 🛠️ Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Firebase Hosting
- Responsive Design

### Backend
- Java 11
- Spring Boot 2.7.9
- Spring Data JPA
- PostgreSQL / MySQL (flexible)
- Maven

## 📦 Deployment

### Quick Deploy to Render (Recommended)
Follow the step-by-step guide in `QUICK_DEPLOY_GUIDE.md`

**Estimated time: 20 minutes**

### What's Included
- ✅ PostgreSQL-compatible database dump
- ✅ Docker configuration
- ✅ Render deployment configuration
- ✅ Comprehensive deployment guides

## 📚 Documentation

- `QUICK_DEPLOY_GUIDE.md` - ⭐ Start here for deployment
- `DEPLOYMENT_READY.md` - Complete overview
- `DEPLOY_RENDER_COMPLETE.md` - Detailed deployment guide
- `CHANGES_SUMMARY.md` - What changed and why

## 💻 Local Development

### Prerequisites
- Java 11 or higher
- Maven 3.6+
- MySQL 8.0 (for local development)
- Node.js (for Firebase CLI)

### Backend Setup
```bash
cd java-backend
mvn spring-boot:run
```
Backend runs on `http://localhost:8081`

### Frontend Setup
```bash
# Serve locally
firebase serve

# Or open index.html in browser
```

## 🗄️ Database Schema

- **subjects**: Quiz subjects (DBMS, FEDF, OOP, OS)
- **questions**: 100 questions with metadata
- **question_options**: 4 options per question
- **quizzes**: Quiz configuration
- **users**: Student and teacher accounts
- **quiz_attempts**: Student attempt history
- **user_answers**: Individual answers per attempt

## 📊 Database Data

- 100 questions across 4 subjects
- All questions include correct answers
- Sample users and quiz attempts
- PostgreSQL-compatible SQL dump included

## 🔧 Configuration

### Environment Variables (for Render)
```
DATABASE_URL=postgresql://...
DATABASE_DRIVER=org.postgresql.Driver
HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
```

### Local Development
Uses `application.properties` with MySQL defaults.

## 🎓 Subjects Covered

1. **DBMS (Database Management Systems)** - 25 questions
   - SQL, normalization, transactions, joins, indexes

2. **FEDF (Front-End Development Frameworks)** - 25 questions
   - React, Angular, Vue.js, Bootstrap, Tailwind CSS

3. **OOP (Object-Oriented Programming)** - 25 questions
   - Classes, inheritance, polymorphism, encapsulation

4. **OS (Operating Systems)** - 25 questions
   - Processes, memory management, scheduling, deadlocks

## 📝 License

Educational use only.

## 🤝 Contributing

This is an educational project. Feel free to fork and customize for your needs.

## 📧 Support

For deployment help, see the comprehensive guides in the `DEPLOY_*` markdown files.

---

**Ready to deploy?** Open `QUICK_DEPLOY_GUIDE.md` and follow the checklist!
