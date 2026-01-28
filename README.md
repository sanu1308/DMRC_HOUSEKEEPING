# DMRC Housekeeping Management System

A comprehensive digital housekeeping management system for Delhi Metro Rail Corporation (DMRC) to track and manage housekeeping operations including staff, chemicals, machinery, and pest control activities across all stations.

## Features

- **Station Management**: Create and manage DMRC stations
- **Chemical Tracking**: Monitor chemical consumption and usage
- **Machinery Management**: Track machinery usage, maintenance, and station-level inventory (total / in-use / working / faulty / maintenance)
- **Staff Management**: Manage staffing patterns and shifts
- **Pest Control**: Document pest control activities
- **Housekeeping Logs**: Track daily housekeeping operations
- **Real-time Filtering**: Filter data by date, station, and other parameters
- **Role-based Access**: Super Admin and User roles with different permissions

## Tech Stack

### Frontend
- HTML5
- CSS3 (Tailwind-inspired custom styling)
- Vanilla JavaScript (ES6+)

### Backend
- Node.js
- Express.js
- MySQL

### Authentication
- JWT (JSON Web Tokens)
- Password hashing with bcryptjs

## Project Structure

```
├── frontend/
│   ├── index.html                 # Landing page
│   ├── login.html                 # Login page
│   ├── admin-dashboard.html       # Super Admin dashboard
│   ├── user-dashboard.html        # User dashboard
│   └── assets/
│       ├── css/
│       │   └── styles.css         # All styles
│       └── js/
│           ├── main.js            # Landing page scripts
│           ├── auth.js            # Authentication utilities
│           ├── admin-dashboard.js # Admin dashboard logic
│           └── user-dashboard.js  # User dashboard logic
│
├── backend/
│   ├── server.js                  # Express server
│   ├── package.json               # Dependencies
│   ├── .env.example               # Environment variables template
│   ├── database.sql               # Database schema and sample data
│   ├── config/
│   │   └── db.js                  # Database configuration
│   ├── middleware/
│   │   └── authMiddleware.js      # Authentication middleware
│   ├── controllers/
│   │   ├── authController.js      # Auth endpoints
│   │   ├── stationController.js   # Station CRUD
│   │   ├── chemicalController.js  # Chemical CRUD
│   │   ├── machineryController.js # Machinery CRUD
│   │   ├── staffController.js     # Staff CRUD
│   │   ├── pestControlController.js # Pest Control CRUD
│   │   └── housekeepingLogController.js # Logs CRUD
│   └── routes/
│       ├── authRoutes.js          # Auth routes
│       └── apiRoutes.js           # API routes
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MySQL Server
- npm or yarn

### Backend Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Database Setup**
```bash
# Create MySQL database
mysql -u root -p < database.sql
```

3. **Configure Environment Variables**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

**Example .env file:**
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=dmrc_housekeeping
JWT_SECRET=your_secret_key_change_in_production
JWT_EXPIRE=7d
PORT=5000
NODE_ENV=development
```

4. **Start Backend Server**
```bash
npm start
# Or with nodemon for development
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Start a Local Server**
The frontend is pure HTML/CSS/JS. You can serve it using:

```bash
# Using Python 3
python -m http.server 8000

# Or using Node.js
npx http-server -p 8000

# Or using PHP
php -S localhost:8000
```

2. **Access the Application**
Open your browser and go to `http://localhost:8000`

## Demo Credentials

Use these credentials to test the application:

**Super Admin:**
- Email: `admin@dmrc.gov.in`
- Password: `password123`

**User:**
- Email: `user@dmrc.gov.in`
- Password: `password123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - Create new user (Super Admin only)
- `GET /api/auth/me` - Get current user info

### Stations (Super Admin)
- `GET /api/stations` - Get all stations
- `POST /api/stations` - Create station
- `PUT /api/stations/:id` - Update station
- `DELETE /api/stations/:id` - Delete station

### Chemicals (Super Admin)
- `GET /api/chemicals` - Get all chemicals
- `POST /api/chemicals` - Create chemical
- `PUT /api/chemicals/:id` - Update chemical
- `DELETE /api/chemicals/:id` - Delete chemical

### Machinery (Super Admin)
- `GET /api/machinery` - Get all machinery
- `POST /api/machinery` - Create machinery
- `PUT /api/machinery/:id` - Update machinery
- `DELETE /api/machinery/:id` - Delete machinery
- `GET /api/admin/machinery-inventory` - Get station-level machinery inventory summary

### Staff (Super Admin)
- `GET /api/staff` - Get all staff records
- `POST /api/staff` - Create staff record
- `PUT /api/staff/:id` - Update staff record
- `DELETE /api/staff/:id` - Delete staff record

### Pest Control (Super Admin)
- `GET /api/pest-control` - Get all pest control records
- `POST /api/pest-control` - Create pest control record
- `PUT /api/pest-control/:id` - Update pest control record
- `DELETE /api/pest-control/:id` - Delete pest control record

### Housekeeping Logs (All Users)
- `GET /api/housekeeping-logs` - Get all logs (Super Admin only)
- `GET /api/housekeeping-logs/user/my-logs` - Get user's own logs
- `POST /api/housekeeping-logs` - Create log
- `PUT /api/housekeeping-logs/:id` - Update log
- `DELETE /api/housekeeping-logs/:id` - Delete log

## Database Schema

### Users Table
- id (PK)
- name
- email (UNIQUE)
- password (hashed)
- role (superadmin/user)
- created_at
- updated_at

### Stations Table
- id (PK)
- station_name
- station_code (UNIQUE)
- created_by (FK → users.id)
- updated_by (FK → users.id)
- created_at, updated_at

### Chemical Products Table
- id (PK)
- chemical_name
- measuring_unit
- quantity
- monthly_quantity
- daily_utilized
- created_by, updated_by (FK)
- created_at, updated_at

### Machinery Table
- id (PK)
- machinery_name
- machine_type
- number_of_days
- station_id (FK → stations.id)
- quantity_total (total machines assigned to the station)
- quantity_in_use (currently deployed in the field)
- quantity_faulty (marked as faulty / unusable)
- quantity_maintenance (machines undergoing maintenance)
- created_by, updated_by (FK)
- created_at, updated_at

### Staff Table
- id (PK)
- date
- day
- station_name
- shift
- manpower
- number_of_persons
- created_by, updated_by (FK)
- created_at, updated_at

### Pest Control Table
- id (PK)
- pest_control_type
- chemical_used
- measuring_unit
- quantity_used
- station_id (FK → stations.id)
- date
- created_by, updated_by (FK)
- created_at, updated_at

### Housekeeping Logs Table
- id (PK)
- user_id (FK → users.id)
- station_id (FK → stations.id)
- chemical_id (FK → chemical_products.id)
- machinery_id (FK → machinery.id)
- staff_id (FK → staff.id)
- pest_control_id (FK → pest_control.id)
- cleaning_area
- cleaning_type
- date
- time
- remarks
- created_at

### Machinery Inventory Migration (existing databases)

If you are upgrading an older database, add the new inventory columns and constraint before starting the server:

```sql
ALTER TABLE machinery
	ADD COLUMN machine_type VARCHAR(100) NOT NULL DEFAULT 'General',
	ADD COLUMN quantity_total INT NOT NULL DEFAULT 1,
	ADD COLUMN quantity_in_use INT NOT NULL DEFAULT 0,
	ADD COLUMN quantity_faulty INT NOT NULL DEFAULT 0,
	ADD COLUMN quantity_maintenance INT NOT NULL DEFAULT 0,
	ADD CONSTRAINT chk_machine_totals CHECK (
		quantity_total >= quantity_in_use + quantity_faulty + quantity_maintenance
	);
```

These fields power the `/api/admin/machinery-inventory` endpoint and the admin dashboard inventory widgets.

## User Roles

### Super Admin
- Create and manage all master data (stations, chemicals, machinery, staff, pest control)
- View all housekeeping logs and reports
- Monitor system in real-time
- Access advanced filtering and reporting tools
- Manage user accounts

### User
- Submit daily housekeeping operation details
- Track their own submissions
- View assigned stations and equipment
- Record cleaning activities and observations

## Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Authentication**: Token-based authentication for APIs
- **Role-based Authorization**: Middleware to enforce role-based access control
- **SQL Injection Prevention**: Parameterized queries using mysql2
- **CORS Protection**: Configured CORS headers

## Development Notes

### Adding New Features
1. Create a new controller in `/backend/controllers/`
2. Add routes in `/backend/routes/apiRoutes.js`
3. Create database tables in `/backend/database.sql`
4. Add UI components in the frontend HTML files
5. Add JavaScript functionality in corresponding JS files

### Code Style
- Use clear, descriptive variable names
- Add comments for complex logic
- Follow the existing project structure
- Use async/await for asynchronous operations

### Debugging
- Check browser console for frontend errors
- Check server logs for backend errors
- Verify database connection and credentials
- Ensure all environment variables are set

## Troubleshooting

### Database Connection Error
- Verify MySQL is running
- Check database credentials in .env
- Ensure database exists: `dmrc_housekeeping`

### CORS Error
- Update CORS origin in `backend/server.js` to match your frontend URL
- Ensure backend is running on the correct port

### Login Failed
- Verify user exists in database
- Check password is correct
- Ensure JWT_SECRET is set in .env

### Missing Data in Dropdowns
- Verify data exists in database
- Check API endpoints are returning data
- Verify authentication token is valid

## Academic Use
This project is designed for academic/educational purposes. It demonstrates:
- Full-stack web development concepts
- RESTful API design
- Database design and management
- Authentication and authorization
- Frontend-backend integration
- Professional UI/UX practices

## Project Submission
This project includes:
- Complete source code
- SQL schema with sample data
- Setup and deployment instructions
- API documentation
- Professional UI design
- Ready-to-run structure

## License
This project is provided as-is for educational purposes.

## Support
For issues or questions regarding this project, please check the code comments and documentation. This is an academic project designed for learning purposes.
