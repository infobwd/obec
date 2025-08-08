// Dashboard JavaScript - Modern Training Management System
// โรงเรียนบ้านวังด้ง - Complete JSONP Integration

// Configuration
const CONFIG = {
    // ใส่ URL ของ Google Apps Script ที่ deploy แล้วที่นี่
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxElsqe49hvCgxI6NXChg74BJtsbsA_q2AmetwQY7SwOwup8IcDUV7R0rXeKDRrNaQP7g/exec',
    REFRESH_INTERVAL: 300000, // 5 minutes
    ANIMATION_DURATION: 300,
    CHART_COLORS: {
        primary: '#1a73e8',
        secondary: '#4285f4',
        yellow: '#fbbc05',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        gray: '#6b7280'
    },
    // ⭐ JSONP Configuration
    API_TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
    USE_JSONP_ONLY: true // Force JSONP only
};

// Global Variables
let dashboardData = {};
let charts = {};
let currentFilters = {};
let currentPage = 1;
let pageSize = 10;
let totalTasks = 0;

// Utility Functions
const Utils = {
    // Format date to Thai format
    formatThaiDate: function(dateString) {
        if (!dateString || dateString === 'No Due Date') return 'ไม่มีกำหนด';
        
        try {
            const date = new Date(dateString);
            const thaiYear = date.getFullYear() + 543;
            const thaiMonths = [
                'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
            ];
            
            return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${thaiYear}`;
        } catch (e) {
            return dateString;
        }
    },

    // Show loading overlay
    showLoading: function(text = 'กำลังโหลดข้อมูล...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = text;
        if (overlay) overlay.classList.add('active');
    },

    // Hide loading overlay
    hideLoading: function() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    // Show success message
    showSuccess: function(message) {
        Swal.fire({
            icon: 'success',
            title: 'สำเร็จ!',
            text: message,
            confirmButtonColor: CONFIG.CHART_COLORS.primary,
            timer: 3000,
            timerProgressBar: true
        });
    },

    // Show error message
    showError: function(message) {
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด!',
            text: message,
            confirmButtonColor: CONFIG.CHART_COLORS.danger
        });
    },

    // Show confirmation dialog
    showConfirm: function(title, text, callback) {
        Swal.fire({
            title: title,
            text: text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: CONFIG.CHART_COLORS.primary,
            cancelButtonColor: CONFIG.CHART_COLORS.gray,
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed && callback) {
                callback();
            }
        });
    },

    // Debounce function
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Generate unique ID
    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Format number with commas
    formatNumber: function(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    // ⭐ Retry function with exponential backoff
    retry: async function(fn, attempts = CONFIG.RETRY_ATTEMPTS, delay = CONFIG.RETRY_DELAY) {
        try {
            return await fn();
        } catch (error) {
            if (attempts <= 1) {
                throw error;
            }
            
            console.log(`Retrying in ${delay}ms... (${CONFIG.RETRY_ATTEMPTS - attempts + 1}/${CONFIG.RETRY_ATTEMPTS})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            return this.retry(fn, attempts - 1, delay * 2);
        }
    },

    // ⭐ Network status checker
    isOnline: function() {
        return navigator.onLine;
    },

    // ⭐ Show network error
    showNetworkError: function() {
        this.showError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    },

    // ⭐ Clean up global functions
    cleanupGlobalFunctions: function() {
        const globalFunctions = Object.keys(window).filter(key => key.startsWith('jsonp_callback_'));
        globalFunctions.forEach(funcName => {
            try {
                delete window[funcName];
            } catch (e) {
                console.warn('Could not delete global function:', funcName);
            }
        });
    }
};

// ⭐ Enhanced JSONP API Client
const API = {
    // ⭐ Enhanced JSONP implementation with better error handling
    callJSONP: function(action, data = {}) {
        return new Promise((resolve, reject) => {
            // Cleanup old callbacks periodically
            if (Math.random() < 0.1) { // 10% chance to cleanup
                Utils.cleanupGlobalFunctions();
            }

            // Create unique callback name
            const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            
            // Create script element
            const script = document.createElement('script');
            
            // Set timeout
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Request timeout - ไม่ได้รับการตอบสนองจากเซิร์ฟเวอร์'));
            }, CONFIG.API_TIMEOUT);
            
            // Cleanup function
            const cleanup = () => {
                clearTimeout(timeout);
                if (script.parentNode) {
                    try {
                        document.head.removeChild(script);
                    } catch (e) {
                        console.warn('Script already removed');
                    }
                }
                if (window[callbackName]) {
                    delete window[callbackName];
                }
            };
            
            // Define callback function
            window[callbackName] = function(response) {
                cleanup();
                
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    const errorMsg = response && response.error ? response.error : 'Unknown error occurred';
                    reject(new Error(errorMsg));
                }
            };
            
            // Build query parameters
            const params = new URLSearchParams();
            params.append('callback', callbackName);
            params.append('action', action);
            
            // ⭐ Enhanced parameter encoding
            Object.keys(data).forEach(key => {
                const value = data[key];
                if (value !== null && value !== undefined) {
                    if (typeof value === 'object') {
                        try {
                            params.append(key, JSON.stringify(value));
                        } catch (e) {
                            console.warn('Failed to stringify parameter:', key, value);
                            params.append(key, String(value));
                        }
                    } else {
                        params.append(key, String(value));
                    }
                }
            });
            
            // Set script source
            const url = CONFIG.GOOGLE_SCRIPT_URL + '?' + params.toString();
            script.src = url;
            
            // Handle script error
            script.onerror = () => {
                cleanup();
                reject(new Error('Script loading failed - ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้'));
            };
            
            // Add script to head
            document.head.appendChild(script);
            
            // Debug logging
            console.log(`[JSONP] ${action}:`, data);
        });
    },

    // ⭐ Main API call function (JSONP only)
    call: async function(action, data = {}) {
        // Check network status
        if (!Utils.isOnline()) {
            throw new Error('ไม่มีการเชื่อมต่ออินเทอร์เน็ต');
        }

        // Use JSONP with retry logic
        return await Utils.retry(async () => {
            console.log(`[API] Making JSONP call for action: ${action}`);
            return await this.callJSONP(action, data);
        });
    },

    // Get dashboard statistics
    getDashboardStats: async function(days = 7) {
        return await this.call('getDashboardStats', { days });
    },

    // Get monthly statistics
    getMonthlyStats: async function(year) {
        return await this.call('getMonthlyStats', { year });
    },

    // Get user statistics
    getUserStats: async function() {
        return await this.call('getUserStatistics');
    },

    // Get upcoming tasks
    getUpcomingTasks: async function(days = 7) {
        return await this.call('getUpcomingTasks', { days });
    },

    // Get training tasks with filters
    getTrainingTasks: async function(filters = {}) {
        return await this.call('getTrainingTasks', { filters });
    },

    // ⭐ Enhanced save training report with better data formatting
    saveTrainingReport: async function(reportData) {
        // Clean and validate data before sending
        const cleanData = {
            taskGid: reportData.taskGid || '',
            knowledgeGained: String(reportData.knowledgeGained || '').trim(),
            implementationPlan: String(reportData.implementationPlan || '').trim(),
            knowledgeSharing: String(reportData.knowledgeSharing || '').trim(),
            suggestionsImages: String(reportData.suggestionsImages || '').trim(),
            lineUid: String(reportData.lineUid || '').trim(),
            timestamp: reportData.timestamp || new Date().toISOString()
        };

        return await this.call('saveTrainingReport', cleanData);
    },

    // Update task status
    updateTaskStatus: async function(taskId, status) {
        return await this.call('updateTaskStatus', { 
            taskId: String(taskId), 
            status: String(status) 
        });
    },

    // Export to Excel
    exportToExcel: async function(filters = {}) {
        return await this.call('exportToExcel', { filters });
    },

    // Sync from Asana
    syncFromAsana: async function() {
        return await this.call('syncFromAsana');
    }
};

// Dashboard Core Functions
const Dashboard = {
    // Initialize dashboard
    init: async function() {
        try {
            Utils.showLoading('กำลังเริ่มต้นระบบ...');
            
            // Initialize event listeners
            this.initEventListeners();
            
            // Check network status
            this.initNetworkMonitoring();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Update time display
            this.updateTimeDisplay();
            setInterval(() => this.updateTimeDisplay(), 1000);
            
            // Set up auto refresh
            setInterval(() => this.refreshData(), CONFIG.REFRESH_INTERVAL);
            
            Utils.hideLoading();
            Utils.showSuccess('ระบบพร้อมใช้งาน (JSONP Mode)');
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            Utils.hideLoading();
            
            if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                Utils.showNetworkError();
            } else {
                Utils.showError('ไม่สามารถเริ่มต้นระบบได้: ' + error.message);
            }
        }
    },

    // ⭐ Network monitoring
    initNetworkMonitoring: function() {
        window.addEventListener('online', () => {
            Utils.showSuccess('เชื่อมต่ออินเทอร์เน็ตแล้ว');
            setTimeout(() => this.refreshData(), 1000);
        });

        window.addEventListener('offline', () => {
            Utils.showError('ขาดการเชื่อมต่ออินเทอร์เน็ต');
        });
    },

    // Initialize event listeners
    initEventListeners: function() {
        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (navbar) {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }
        });

        // Mobile menu toggle
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // Training modal buttons
        const openModalBtns = document.querySelectorAll('#open-training-modal, #open-training-modal-mobile');
        openModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.openTrainingModal());
        });

        const closeModalBtn = document.getElementById('close-training-modal');
        const cancelBtn = document.getElementById('cancel-training');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.closeTrainingModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeTrainingModal());

        // Training form submission
        const trainingForm = document.getElementById('training-form');
        if (trainingForm) {
            trainingForm.addEventListener('submit', (e) => this.handleTrainingFormSubmit(e));
        }

        // Filter controls
        const filterControls = ['filter-year', 'filter-assignee', 'filter-month', 'filter-status'];
        filterControls.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
            }
        });

        // Search functionality
        const searchInput = document.getElementById('task-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));
        }

        const clearSearchBtn = document.getElementById('clear-search');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.applyFilters();
            });
        }

        // Page size selector
        const pageSizeSelect = document.getElementById('page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                pageSize = parseInt(e.target.value);
                currentPage = 1;
                this.renderTasksTable();
            });
        }

        // Upcoming tasks period buttons
        const periodBtns = document.querySelectorAll('#days-7, #days-15, #days-30');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                periodBtns.forEach(b => {
                    b.classList.remove('bg-blue-100', 'text-blue-700');
                    b.classList.add('bg-gray-100', 'text-gray-700');
                });
                
                // Add active class to clicked button
                e.target.classList.remove('bg-gray-100', 'text-gray-700');
                e.target.classList.add('bg-blue-100', 'text-blue-700');
                
                // Get days from button id
                const days = parseInt(e.target.id.split('-')[1]);
                this.loadUpcomingTasks(days);
            });
        });

        // Chart type toggle
        const toggleChartBtn = document.getElementById('toggle-chart-type');
        if (toggleChartBtn) {
            toggleChartBtn.addEventListener('click', () => this.toggleChartType());
        }

        // Year selector for chart
        const yearSelector = document.getElementById('year-selector');
        if (yearSelector) {
            yearSelector.addEventListener('change', (e) => {
                this.loadMonthlyChart(parseInt(e.target.value));
            });
        }

        // Action buttons with improved error handling
        const exportBtn = document.getElementById('export-excel');
        const syncBtn = document.getElementById('sync-asana');
        const reportsBtn = document.getElementById('view-reports');

        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                try {
                    await this.exportData();
                } catch (error) {
                    console.error('Export error:', error);
                    if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                        Utils.showNetworkError();
                    } else {
                        Utils.showError('ไม่สามารถส่งออกข้อมูลได้: ' + error.message);
                    }
                }
            });
        }

        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                try {
                    await this.syncData();
                } catch (error) {
                    console.error('Sync error:', error);
                    if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                        Utils.showNetworkError();
                    } else {
                        Utils.showError('ไม่สามารถซิงค์ข้อมูลได้: ' + error.message);
                    }
                }
            });
        }

        if (reportsBtn) reportsBtn.addEventListener('click', () => this.viewReports());

        // Modal overlay click to close
        const modalOverlay = document.getElementById('training-modal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.closeTrainingModal();
                }
            });
        }
    },

    // Update time display
    updateTimeDisplay: function() {
        const now = new Date();
        const dateElement = document.getElementById('current-date');
        const timeElement = document.getElementById('current-time');

        if (dateElement) {
            const thaiDate = Utils.formatThaiDate(now.toISOString().split('T')[0]);
            dateElement.textContent = thaiDate;
        }

        if (timeElement) {
            const timeString = now.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = timeString;
        }
    },

    // ⭐ Enhanced load dashboard data with better error handling
    loadDashboardData: async function() {
        try {
            Utils.showLoading('กำลังโหลดข้อมูล Dashboard...');

            console.log('[Dashboard] Loading dashboard data via JSONP...');

            // Load all data in parallel with individual error handling
            const promises = [
                API.getDashboardStats().catch(err => {
                    console.error('Stats loading failed:', err);
                    return null;
                }),
                API.getMonthlyStats().catch(err => {
                    console.error('Monthly stats loading failed:', err);
                    return null;
                }),
                API.getUserStats().catch(err => {
                    console.error('User stats loading failed:', err);
                    return [];
                }),
                API.getUpcomingTasks(7).catch(err => {
                    console.error('Upcoming tasks loading failed:', err);
                    return [];
                })
            ];

            const [statsData, monthlyData, userStatsData, upcomingTasksData] = await Promise.all(promises);

            // Store data with fallbacks
            dashboardData = {
                stats: statsData || this.getDefaultStats(),
                monthly: monthlyData || this.getDefaultMonthly(),
                userStats: userStatsData || [],
                upcomingTasks: upcomingTasksData || []
            };

            console.log('[Dashboard] Data loaded successfully:', dashboardData);

            // Render components
            this.renderStatsCards();
            this.renderMonthlyChart();
            this.renderUserChart();
            this.renderTopUsers();
            this.renderUpcomingTasks();
            this.populateFilterOptions();
            this.loadTasksTable();

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            
            // Use default data on complete failure
            dashboardData = {
                stats: this.getDefaultStats(),
                monthly: this.getDefaultMonthly(),
                userStats: [],
                upcomingTasks: []
            };

            this.renderStatsCards();
            
            if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                Utils.showNetworkError();
            } else {
                Utils.showError('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
            }
        } finally {
            Utils.hideLoading();
        }
    },

    // ⭐ Default data fallbacks
    getDefaultStats: function() {
        return {
            summary: {
                totalTasks: 0,
                completedTasks: 0,
                pendingTasks: 0,
                currentYearTasks: 0,
                currentMonthTasks: 0,
                upcomingTasks: 0,
                uniqueAssignees: 0,
                completionRate: 0
            },
            currentYear: new Date().getFullYear() + 543,
            currentMonth: new Date().getMonth() + 1
        };
    },

    getDefaultMonthly: function() {
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];

        return {
            monthlyData: thaiMonths.map((month, index) => ({
                month: month,
                monthNumber: index + 1,
                total: 0,
                completed: 0,
                pending: 0
            })),
            targetYear: new Date().getFullYear() + 543
        };
    },

    // ⭐ Refresh data with better error handling
    refreshData: async function() {
        try {
            Utils.showLoading('กำลังรีเฟรชข้อมูล...');
            await this.loadDashboardData();
            console.log('[Dashboard] Data refreshed successfully');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            // Don't show error for auto-refresh failures
            if (!error.message.includes('timeout')) {
                Utils.showError('ไม่สามารถรีเฟรชข้อมูลได้');
            }
        }
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add some startup delay to ensure all resources are loaded
    setTimeout(() => {
        Dashboard.init();
    }, 100);
});
