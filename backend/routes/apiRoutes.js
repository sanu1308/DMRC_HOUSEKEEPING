const express = require('express');
const { verifyToken, verifySuperAdmin, verifyUser } = require('../middleware/authMiddleware');

// Import controllers
const areaController = require('../controllers/areaController');
const stationController = require('../controllers/stationController');
const chemicalController = require('../controllers/chemicalController');
const machineryController = require('../controllers/machineryController');
const staffController = require('../controllers/staffController');
const pestControlController = require('../controllers/pestControlController');
const housekeepingLogController = require('../controllers/housekeepingLogController');
const chemicalUsageController = require('../controllers/chemicalUsageController');
const machineryUsageController = require('../controllers/machineryUsageController');
const shiftController = require('../controllers/shiftController');
const inventoryController = require('../controllers/inventoryController');
const dashboardController = require('../controllers/dashboardController');
const reportsController = require('../controllers/reportsController');
const manpowerController = require('../controllers/manpowerController');
const stationPulseController = require('../controllers/stationPulseController');

const router = express.Router();

// ==================== AREAS ====================
// Super Admin only
router.post('/areas', verifyToken, verifySuperAdmin, areaController.createArea);
router.put('/areas/:id', verifyToken, verifySuperAdmin, areaController.updateArea);
router.delete('/areas/:id', verifyToken, verifySuperAdmin, areaController.deleteArea);

// All authenticated users
router.get('/areas', verifyToken, areaController.getAreas);
router.get('/areas/:id', verifyToken, areaController.getAreaById);

// ==================== STATIONS ====================
// Super Admin only
router.post('/stations', verifyToken, verifySuperAdmin, stationController.createStation);
router.put('/stations/:id', verifyToken, verifySuperAdmin, stationController.updateStation);
router.delete('/stations/:id', verifyToken, verifySuperAdmin, stationController.deleteStation);

// All authenticated users
router.get('/stations', verifyToken, stationController.getAllStations);
router.get('/stations/:id', verifyToken, stationController.getStationById);

// ==================== CHEMICALS ====================
// Super Admin only
router.post('/chemicals', verifyToken, verifySuperAdmin, chemicalController.createChemical);
router.put('/chemicals/:id', verifyToken, verifySuperAdmin, chemicalController.updateChemical);
router.delete('/chemicals/:id', verifyToken, verifySuperAdmin, chemicalController.deleteChemical);

// All authenticated users
router.get('/chemicals', verifyToken, chemicalController.getAllChemicals);
router.get('/chemicals/:id', verifyToken, chemicalController.getChemicalById);

// ==================== MACHINERY ====================
// Super Admin only
router.post('/machinery', verifyToken, verifySuperAdmin, machineryController.createMachinery);
router.put('/machinery/:id', verifyToken, verifySuperAdmin, machineryController.updateMachinery);
router.delete('/machinery/:id', verifyToken, verifySuperAdmin, machineryController.deleteMachinery);

// All authenticated users
router.get('/machinery', verifyToken, machineryController.getAllMachinery);
router.get('/machinery/:id', verifyToken, machineryController.getMachineryById);

// ==================== STAFF ====================
// Super Admin only
router.post('/staff', verifyToken, verifySuperAdmin, staffController.createStaff);
router.put('/staff/:id', verifyToken, verifySuperAdmin, staffController.updateStaff);
router.delete('/staff/:id', verifyToken, verifySuperAdmin, staffController.deleteStaff);

// All authenticated users
router.get('/staff', verifyToken, staffController.getAllStaff);
router.get('/staff/:id', verifyToken, staffController.getStaffById);
router.get('/admin/staff-status', verifyToken, verifySuperAdmin, staffController.getStaffStatus);

// ==================== PEST CONTROL ====================
// Staff can create their own entries; admins manage existing ones
router.post('/pest-control', verifyToken, verifyUser, pestControlController.createPestControl);
router.put('/pest-control/:id', verifyToken, verifySuperAdmin, pestControlController.updatePestControl);
router.delete('/pest-control/:id', verifyToken, verifySuperAdmin, pestControlController.deletePestControl);

// All authenticated users
router.get('/pest-control', verifyToken, pestControlController.getAllPestControl);
router.get('/pest-control/:id', verifyToken, pestControlController.getPestControlById);
router.get(
	'/pest-types',
	verifyToken,
	pestControlController.getPestTypes,
);

// ==================== HOUSEKEEPING LOGS ====================
// Super Admin - view all logs
router.get('/housekeeping-logs', verifyToken, verifySuperAdmin, housekeepingLogController.getAllHousekeepingLogs);
router.get('/housekeeping-logs/:id', verifyToken, housekeepingLogController.getHousekeepingLogById);

// All authenticated users - create and manage logs
router.post('/housekeeping-logs', verifyToken, housekeepingLogController.createHousekeepingLog);
router.put('/housekeeping-logs/:id', verifyToken, housekeepingLogController.updateHousekeepingLog);
router.delete('/housekeeping-logs/:id', verifyToken, housekeepingLogController.deleteHousekeepingLog);

// Users - view their own logs
router.get('/housekeeping-logs/user/my-logs', verifyToken, verifyUser, housekeepingLogController.getMyHousekeepingLogs);

// ==================== USAGE TRACKING (for staff dashboard) ====================
// Chemical usage - staff can track their own usage
router.get('/chemical-usage', verifyToken, chemicalUsageController.getChemicalUsage);
router.post('/chemical-usage', verifyToken, verifyUser, chemicalUsageController.createChemicalUsage);
router.delete('/chemical-usage/:id', verifyToken, verifyUser, chemicalUsageController.deleteChemicalUsage);

// Machinery usage - staff can track their own usage
router.get('/machinery-usage', verifyToken, machineryUsageController.getMachineryUsage);
router.post('/machinery-usage', verifyToken, verifyUser, machineryUsageController.createMachineryUsage);
router.delete('/machinery-usage/:id', verifyToken, verifyUser, machineryUsageController.deleteMachineryUsage);

// Shifts list - simple static list for client dropdowns
router.get('/shifts', verifyToken, shiftController.getShifts);

// ==================== ADMIN ANALYTICS & FILTERS ====================
// Dashboard statistics with auto-updating cards (Super Admin only)
router.get('/admin/dashboard', verifyToken, verifySuperAdmin, dashboardController.getDashboardStats);

// Inventory status with stock calculations (Super Admin only)
router.get('/admin/inventory', verifyToken, verifySuperAdmin, inventoryController.getInventoryStatus);

// Chemical usage analytics with advanced filters (Super Admin only)
router.get('/admin/chemical-usage', verifyToken, verifySuperAdmin, chemicalUsageController.getAdminChemicalUsage);

// Pest control analytics with recurring issue detection (Super Admin only)
router.get('/admin/pest-control', verifyToken, verifySuperAdmin, pestControlController.getAdminPestControl);

// Machinery usage analytics with performance analysis (Super Admin only)
router.get('/admin/machinery-usage', verifyToken, verifySuperAdmin, machineryUsageController.getAdminMachineryUsage);
router.get('/admin/machinery-inventory', verifyToken, verifySuperAdmin, machineryController.getMachineryInventorySummary);
router.get('/admin/station-pulse', verifyToken, verifySuperAdmin, stationPulseController.getStationPulseOverview);
router.post('/admin/station-pulse/alerts/:id/acknowledge', verifyToken, verifySuperAdmin, stationPulseController.acknowledgeAlert);
router.post('/admin/station-pulse/exports', verifyToken, verifySuperAdmin, stationPulseController.createExportRequest);

// Station manpower management (Super Admin only)
router.get('/admin/manpower', verifyToken, verifySuperAdmin, manpowerController.getStationManpower);
router.post('/admin/manpower', verifyToken, verifySuperAdmin, manpowerController.upsertStationManpower);
router.get('/admin/manpower/usage', verifyToken, verifySuperAdmin, manpowerController.getSectionUsage);

// ==================== ADMIN REPORTS ====================
// Daily cleaning report (Super Admin only)
router.get('/admin/reports/daily-cleaning', verifyToken, verifySuperAdmin, reportsController.getDailyCleaningReport);

// Monthly chemical consumption report (Super Admin only)
router.get('/admin/reports/chemical-consumption', verifyToken, verifySuperAdmin, reportsController.getChemicalConsumptionReport);

// Staff utilization report (Super Admin only)
router.get('/admin/reports/staff-utilization', verifyToken, verifySuperAdmin, reportsController.getStaffUtilizationReport);

module.exports = router;
