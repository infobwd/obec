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
    },

    // ⭐ Load tasks table with JSONP
    loadTasksTable: async function() {
        try {
            Utils.showLoading('กำลังโหลดรายการงาน...');
            
            const filters = this.getCurrentFilters();
            console.log('[Tasks] Loading with filters:', filters);
            
            const tasksData = await API.getTrainingTasks(filters);
            
            console.log('[Tasks] Data received:', tasksData);
            
            // Handle both array and object responses
            const tasks = Array.isArray(tasksData) ? tasksData : (tasksData.data || []);
            
            dashboardData.tasks = tasks;
            totalTasks = tasks.length;
            
            this.renderTasksTable();
            
        } catch (error) {
            console.error('Failed to load tasks table:', error);
            
            if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                Utils.showNetworkError();
            } else {
                Utils.showError('ไม่สามารถโหลดรายการงานได้: ' + error.message);
            }
        } finally {
            Utils.hideLoading();
        }
    },

    // Get current filters
    getCurrentFilters: function() {
        const filters = {};
        
        const yearFilter = document.getElementById('filter-year');
        const assigneeFilter = document.getElementById('filter-assignee');
        const monthFilter = document.getElementById('filter-month');
        const statusFilter = document.getElementById('filter-status');
        const searchInput = document.getElementById('task-search');
        
        if (yearFilter && yearFilter.value) filters.year = yearFilter.value;
        if (assigneeFilter && assigneeFilter.value) filters.assignee = assigneeFilter.value;
        if (monthFilter && monthFilter.value) filters.month = monthFilter.value;
        if (statusFilter && statusFilter.value) filters.status = statusFilter.value;
        if (searchInput && searchInput.value.trim()) filters.search = searchInput.value.trim();
        
        return filters;
    },

    // Apply filters
    applyFilters: function() {
        currentPage = 1;
        this.loadTasksTable();
    },

    // Render tasks table
    renderTasksTable: function() {
        const tbody = document.getElementById('tasks-tbody');
        const tasksCount = document.getElementById('tasks-count');
        const paginationInfo = document.getElementById('pagination-info');
        
        if (!tbody) return;

        // Handle missing tasks data
        if (!dashboardData.tasks) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-gray-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4 opacity-50"></i>
                        <p>ไม่สามารถโหลดข้อมูลได้</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Apply search filter if exists
        let filteredTasks = dashboardData.tasks;
        const searchInput = document.getElementById('task-search');
        if (searchInput && searchInput.value.trim()) {
            const searchTerm = searchInput.value.trim().toLowerCase();
            filteredTasks = dashboardData.tasks.filter(task => 
                (task.name && task.name.toLowerCase().includes(searchTerm)) ||
                (task.assignee && task.assignee.toLowerCase().includes(searchTerm))
            );
        }

        // Update tasks count
        if (tasksCount) {
            tasksCount.textContent = Utils.formatNumber(filteredTasks.length);
        }

        // Calculate pagination
        const totalPages = Math.ceil(filteredTasks.length / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, filteredTasks.length);
        const currentTasks = filteredTasks.slice(startIndex, endIndex);

        // Render table rows
        if (currentTasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                        <p>ไม่พบข้อมูลงานอบรม</p>
                    </td>
                </tr>
            `;
        } else {
            const rowsHTML = currentTasks.map((task, index) => {
                const statusBadge = task.completed === 'Yes' 
                    ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">เสร็จสมบูรณ์</span>'
                    : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">ยังไม่เสร็จ</span>';

                return `
                    <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors fade-in" 
                        style="animation-delay: ${index * 0.05}s">
                        <td class="py-3 px-4">
                            <div class="font-medium text-gray-900">${task.name || 'ไม่มีชื่องาน'}</div>
                            ${task.link ? `
                                <a href="${task.link}" target="_blank" 
                                   class="text-sm text-blue-600 hover:text-blue-800 transition-colors">
                                    <i class="fas fa-external-link-alt mr-1"></i>ดูรายละเอียด
                                </a>
                            ` : ''}
                        </td>
                        <td class="py-3 px-4">
                            <div class="text-gray-900">${task.assignee || 'ไม่มีผู้รับผิดชอบ'}</div>
                            ${task.assigneeEmail ? `
                                <div class="text-sm text-gray-500">${task.assigneeEmail}</div>
                            ` : ''}
                        </td>
                        <td class="py-3 px-4">
                            <div class="text-gray-900">${Utils.formatThaiDate(task.dueDate)}</div>
                            ${task.dueDateThai ? `
                                <div class="text-sm text-gray-500">${task.dueDateThai}</div>
                            ` : ''}
                        </td>
                        <td class="py-3 px-4">${statusBadge}</td>
                        <td class="py-3 px-4">
                            <div class="flex space-x-2">
                                ${task.completed !== 'Yes' ? `
                                    <button onclick="Dashboard.markTaskComplete('${task.id}')" 
                                            class="text-green-600 hover:text-green-800 transition-colors"
                                            title="ทำเครื่องหมายเสร็จ">
                                        <i class="fas fa-check"></i>
                                    </button>
                                ` : ''}
                                <button onclick="Dashboard.openTrainingModal('${task.id}')" 
                                        class="text-blue-600 hover:text-blue-800 transition-colors"
                                        title="บันทึกรายงานการอบรม">
                                    <i class="fas fa-edit"></i>
                                </button>
                                ${task.link ? `
                                    <a href="${task.link}" target="_blank" 
                                       class="text-gray-600 hover:text-gray-800 transition-colors"
                                       title="ดูรายละเอียด">
                                        <i class="fas fa-external-link-alt"></i>
                                    </a>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = rowsHTML;
        }

        // Update pagination info
        if (paginationInfo) {
            paginationInfo.textContent = `แสดง ${startIndex + 1}-${endIndex} จาก ${Utils.formatNumber(filteredTasks.length)} รายการ`;
        }

        // Render pagination controls
        this.renderPaginationControls(totalPages, filteredTasks.length);
    },

    // Render pagination controls
    renderPaginationControls: function(totalPages, totalItems) {
        const paginationControls = document.getElementById('pagination-controls');
        if (!paginationControls || totalPages <= 1) {
            if (paginationControls) paginationControls.innerHTML = '';
            return;
        }

        let controlsHTML = '';

        // Previous button
        controlsHTML += `
            <button onclick="Dashboard.goToPage(${currentPage - 1})" 
                    class="px-3 py-1 border rounded-lg ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}"
                    ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            controlsHTML += `
                <button onclick="Dashboard.goToPage(1)" 
                        class="px-3 py-1 border rounded-lg bg-white text-gray-700 hover:bg-gray-50">1</button>
            `;
            if (startPage > 2) {
                controlsHTML += '<span class="px-2 text-gray-500">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            controlsHTML += `
                <button onclick="Dashboard.goToPage(${i})" 
                        class="px-3 py-1 border rounded-lg ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}">${i}</button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                controlsHTML += '<span class="px-2 text-gray-500">...</span>';
            }
            controlsHTML += `
                <button onclick="Dashboard.goToPage(${totalPages})" 
                        class="px-3 py-1 border rounded-lg bg-white text-gray-700 hover:bg-gray-50">${totalPages}</button>
            `;
        }

        // Next button
        controlsHTML += `
            <button onclick="Dashboard.goToPage(${currentPage + 1})" 
                    class="px-3 py-1 border rounded-lg ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}"
                    ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationControls.innerHTML = controlsHTML;
    },

    // Go to specific page
    goToPage: function(page) {
        if (page < 1 || page > Math.ceil(totalTasks / pageSize)) return;
        currentPage = page;
        this.renderTasksTable();
    },

    // ⭐ Open training modal
    openTrainingModal: function(taskId = null) {
        const modal = document.getElementById('training-modal');
        const form = document.getElementById('training-form');
        
        if (!modal || !form) return;

        // Reset form
        form.reset();
        
        // Set task ID if provided
        if (taskId) {
            const taskGidInput = document.getElementById('task-gid');
            if (taskGidInput) taskGidInput.value = taskId;
        }

        // Set timestamp
        const timestampInput = document.getElementById('timestamp');
        if (timestampInput) {
            timestampInput.value = new Date().toISOString();
        }

        // Show modal
        modal.classList.add('active');
        
        // Focus on first input
        const firstInput = form.querySelector('textarea, input[type="text"]');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 300);
        }
    },

    // Close training modal
    closeTrainingModal: function() {
        const modal = document.getElementById('training-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // ⭐ Handle training form submit with JSONP
    handleTrainingFormSubmit: async function(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Validate required fields
        const requiredFields = [
            { name: 'knowledgeGained', label: 'ความรู้/ผลที่ได้รับ' },
            { name: 'implementationPlan', label: 'แนวทางปฏิบัติที่ต้องดำเนินการต่อ' },
            { name: 'knowledgeSharing', label: 'การนำความรู้ไปเผยแพร่' },
            { name: 'lineUid', label: 'LINE UID' }
        ];
        
        const missingFields = [];
        
        requiredFields.forEach(field => {
            const value = formData.get(field.name);
            if (!value || value.trim() === '') {
                missingFields.push(field.label);
            }
        });
        
        if (missingFields.length > 0) {
            Utils.showError('กรุณากรอกข้อมูลในช่องต่อไปนี้:\n• ' + missingFields.join('\n• '));
            return;
        }

        try {
            Utils.showLoading('กำลังบันทึกรายงาน...');
            
            // Prepare data for JSONP submission
            const reportData = {
                taskGid: formData.get('taskGid') || this.generateTaskGID(),
                knowledgeGained: formData.get('knowledgeGained').trim(),
                implementationPlan: formData.get('implementationPlan').trim(),
                knowledgeSharing: formData.get('knowledgeSharing').trim(),
                suggestionsImages: formData.get('suggestionsImages') ? formData.get('suggestionsImages').trim() : '',
                lineUid: formData.get('lineUid').trim(),
                timestamp: formData.get('timestamp') || new Date().toISOString()
            };
            
            console.log('[Training] Submitting report via JSONP:', reportData);
            
            // Save to Google Sheets via JSONP
            const result = await API.saveTrainingReport(reportData);
            
            console.log('[Training] Report saved successfully:', result);
            
            Utils.showSuccess('บันทึกรายงานการอบรมเรียบร้อย');
            this.closeTrainingModal();
            
            // Refresh data
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Failed to save training report:', error);
            
            if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                Utils.showNetworkError();
            } else {
                Utils.showError('ไม่สามารถบันทึกรายงานได้: ' + error.message);
            }
        } finally {
            Utils.hideLoading();
        }
    },

    // Generate Task GID
    generateTaskGID: function() {
        const timestamp = new Date().getTime();
        const random = Math.random().toString(36).substr(2, 5);
        return `TRN-${timestamp}-${random}`.toUpperCase();
    },

    // ⭐ Mark task as complete with JSONP
    markTaskComplete: async function(taskId) {
        Utils.showConfirm(
            'ยืนยันการทำเครื่องหมาย',
            'คุณต้องการทำเครื่องหมายงานนี้เป็นเสร็จสมบูรณ์หรือไม่?',
            async () => {
                try {
                    Utils.showLoading('กำลังอัปเดตสถานะ...');
                    
                    console.log('[Task] Updating status via JSONP:', taskId);
                    const result = await API.updateTaskStatus(taskId, 'Yes');
                    console.log('[Task] Status updated:', result);
                    
                    Utils.showSuccess('อัปเดตสถานะเรียบร้อย');
                    await this.loadTasksTable();
                    await this.loadDashboardData();
                    
                } catch (error) {
                    console.error('Failed to update task status:', error);
                    
                    if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                        Utils.showNetworkError();
                    } else {
                        Utils.showError('ไม่สามารถอัปเดตสถานะได้: ' + error.message);
                    }
                } finally {
                    Utils.hideLoading();
                }
            }
        );
    },

    // Export and sync data functions...
    exportData: async function() {
        try {
            Utils.showLoading('กำลังเตรียมไฟล์ Excel...');
            
            const filters = this.getCurrentFilters();
            console.log('[Export] Exporting data via JSONP with filters:', filters);
            
            const result = await API.exportToExcel(filters);
            
            if (result.downloadUrl) {
                const link = document.createElement('a');
                link.href = result.downloadUrl;
                link.download = result.filename || 'training_data.xlsx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Utils.showSuccess('ดาวน์โหลดไฟล์ Excel เรียบร้อย');
            } else {
                Utils.showSuccess('ฟีเจอร์ส่งออก Excel จะเปิดใช้งานในเร็วๆ นี้');
            }
            
        } catch (error) {
            console.error('Failed to export data:', error);
            throw error;
        } finally {
            Utils.hideLoading();
        }
    },

    syncData: async function() {
        Utils.showConfirm(
            'ยืนยันการซิงค์ข้อมูล',
            'คุณต้องการซิงค์ข้อมูลจาก Asana หรือไม่? การดำเนินการนี้อาจใช้เวลาสักครู่',
            async () => {
                try {
                    Utils.showLoading('กำลังซิงค์ข้อมูลจาก Asana...');
                    
                    console.log('[Sync] Syncing data from Asana via JSONP...');
                    const result = await API.syncFromAsana();
                    
                    Utils.showSuccess(`ซิงค์ข้อมูลเรียบร้อย: อัปเดต ${result.updated || 0} รายการ`);
                    
                    await this.loadDashboardData();
                    
                } catch (error) {
                    console.error('Failed to sync data:', error);
                    throw error;
                } finally {
                    Utils.hideLoading();
                }
            }
        );
    },

    viewReports: function() {
        Utils.showSuccess('ฟีเจอร์รายงานจะเปิดใช้งานในเร็วๆ นี้');
    },

    // UI rendering functions
    renderStatsCards: function() {
        const statsSection = document.getElementById('stats-section');
        if (!statsSection || !dashboardData.stats) return;

        const stats = dashboardData.stats.summary;
        const cardsData = [
            {
                title: 'งานทั้งหมด',
                value: Utils.formatNumber(stats.totalTasks),
                icon: 'fas fa-tasks',
                bgClass: 'stat-card'
            },
            {
                title: 'เสร็จสมบูรณ์',
                value: Utils.formatNumber(stats.completedTasks),
                icon: 'fas fa-check-circle',
                bgClass: 'stat-card'
            },
            {
                title: 'ยังไม่เสร็จ',
                value: Utils.formatNumber(stats.pendingTasks),
                icon: 'fas fa-clock',
                bgClass: 'stat-card yellow'
            },
            {
                title: 'งานปีนี้',
                value: Utils.formatNumber(stats.currentYearTasks),
                icon: 'fas fa-calendar-alt',
                bgClass: 'stat-card white'
            },
            {
                title: 'งานเดือนนี้',
                value: Utils.formatNumber(stats.currentMonthTasks),
                icon: 'fas fa-calendar-day',
                bgClass: 'stat-card'
            },
            {
                title: 'กำลังจะมาถึง',
                value: Utils.formatNumber(stats.upcomingTasks),
                icon: 'fas fa-exclamation-triangle',
                bgClass: 'stat-card yellow'
            }
        ];

        const cardsHTML = cardsData.map(card => `
            <div class="${card.bgClass} fade-in">
                <div class="stat-card-content">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm opacity-90 mb-1">${card.title}</p>
                            <p class="text-2xl font-bold">${card.value}</p>
                        </div>
                        <div class="text-3xl opacity-80">
                            <i class="${card.icon}"></i>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        statsSection.innerHTML = cardsHTML;

        if (stats.totalTasks > 0) {
            const completionRateHTML = `
                <div class="lg:col-span-2 modern-card fade-in mt-4">
                    <div class="p-4">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-700">อัตราความสำเร็จโดยรวม</span>
                            <span class="text-sm font-bold text-blue-600">${stats.completionRate}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${stats.completionRate}%"></div>
                        </div>
                    </div>
                </div>
            `;
            statsSection.insertAdjacentHTML('afterend', completionRateHTML);
        }
    },

    renderMonthlyChart: function() {
        console.log('[Chart] renderMonthlyChart called with data:', dashboardData.monthly);
        // Chart implementation placeholder
    },

    renderUserChart: function() {
        console.log('[Chart] renderUserChart called with data:', dashboardData.userStats);
        // Chart implementation placeholder
    },

    renderTopUsers: function() {
        const container = document.getElementById('top-users');
        if (!container || !dashboardData.userStats) return;

        const topUsers = dashboardData.userStats.slice(0, 5);

        if (topUsers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-users text-4xl mb-4 opacity-50"></i>
                    <p>ไม่มีข้อมูลผู้ใช้</p>
                </div>
            `;
            return;
        }

        const usersHTML = topUsers.map((user, index) => {
            const rankIcons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const rankIcon = rankIcons[index] || '📍';

            return `
                <div class="user-stat-item slide-in" style="animation-delay: ${index * 0.1}s">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl">${rankIcon}</span>
                            <div>
                                <p class="font-semibold text-gray-800">${user.assignee}</p>
                                <p class="text-sm text-gray-600">${user.email || 'ไม่มีอีเมล'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-lg text-blue-600">${Utils.formatNumber(user.totalTasks)}</p>
                            <p class="text-sm text-gray-500">งาน</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <div class="flex justify-between text-sm mb-1">
                            <span>อัตราความสำเร็จ</span>
                            <span class="font-semibold">${user.completionRate}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${user.completionRate}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = usersHTML;
    },

    renderUpcomingTasks: function() {
        const container = document.getElementById('upcoming-tasks');
        if (!container) return;

        const tasks = Array.isArray(dashboardData.upcomingTasks) 
            ? dashboardData.upcomingTasks 
            : dashboardData.upcomingTasks?.data || [];

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-calendar-check text-4xl mb-4 opacity-50"></i>
                    <p>ไม่มีงานที่กำลังจะมาถึง</p>
                </div>
            `;
            return;
        }

        const tasksHTML = tasks.slice(0, 10).map((task, index) => {
            const daysUntil = parseInt(task.daysUntilDue) || 0;
            let taskClass = 'normal';
            let urgencyText = '';
            let urgencyIcon = 'fas fa-calendar';

            if (daysUntil === 0) {
                taskClass = 'today';
                urgencyText = 'วันนี้';
                urgencyIcon = 'fas fa-exclamation-circle';
            } else if (daysUntil <= 3) {
                taskClass = 'urgent';
                urgencyText = `อีก ${daysUntil} วัน`;
                urgencyIcon = 'fas fa-clock';
            } else {
                urgencyText = `อีก ${daysUntil} วัน`;
            }

            return `
                <div class="task-item ${taskClass} p-4 slide-in" style="animation-delay: ${index * 0.05}s">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800 mb-1">${task.name}</h4>
                            <p class="text-sm text-gray-600 mb-2">
                                <i class="fas fa-user mr-1"></i>
                                ${task.assignee}
                            </p>
                            <div class="flex items-center text-sm">
                                <i class="${urgencyIcon} mr-1"></i>
                                <span class="font-medium">${urgencyText}</span>
                                <span class="mx-2">•</span>
                                <span class="text-gray-500">${Utils.formatThaiDate(task.dueDate)}</span>
                            </div>
                        </div>
                        <div class="ml-4">
                            ${task.link ? `
                                <a href="${task.link}" target="_blank" 
                                   class="text-blue-600 hover:text-blue-800 transition-colors">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = tasksHTML;
    },

    populateFilterOptions: function() {
        // Populate year filter
        const yearFilter = document.getElementById('filter-year');
        if (yearFilter) {
            const currentYear = new Date().getFullYear() + 543;
            const years = [];
            for (let year = 2565; year <= currentYear + 2; year++) {
                years.push(year);
            }
            
            yearFilter.innerHTML = '<option value="">ทุกปี</option>' + 
                years.map(year => `<option value="${year}">${year}</option>`).join('');
        }

        // Populate assignee filter
        const assigneeFilter = document.getElementById('filter-assignee');
        if (assigneeFilter && dashboardData.userStats) {
            const assignees = dashboardData.userStats.map(user => user.assignee);
            assigneeFilter.innerHTML = '<option value="">ทุกคน</option>' + 
                assignees.map(assignee => `<option value="${assignee}">${assignee}</option>`).join('');
        }
    },

    toggleChartType: function() {
        console.log('[Chart] Toggle chart type requested');
        Utils.showSuccess('ฟีเจอร์เปลี่ยนประเภทแผนภูมิจะเปิดใช้งานเมื่อมี Chart.js');
    },

    loadMonthlyChart: async function(year) {
        try {
            Utils.showLoading('กำลังโหลดข้อมูลรายเดือน...');
            
            const monthlyData = await API.getMonthlyStats(year);
            dashboardData.monthly = monthlyData;
            
            this.renderMonthlyChart();
            
        } catch (error) {
            console.error('Failed to load monthly chart:', error);
            Utils.showError('ไม่สามารถโหลดข้อมูลรายเดือนได้');
        } finally {
            Utils.hideLoading();
        }
    },

    loadUpcomingTasks: async function(days) {
        try {
            Utils.showLoading('กำลังโหลดงานที่กำลังจะมาถึง...');
            
            const upcomingTasks = await API.getUpcomingTasks(days);
            dashboardData.upcomingTasks = upcomingTasks;
            
            this.renderUpcomingTasks();
            
        } catch (error) {
            console.error('Failed to load upcoming tasks:', error);
            Utils.showError('ไม่สามารถโหลดงานที่กำลังจะมาถึงได้');
        } finally {
            Utils.hideLoading();
        }
    }
};

// Make functions globally accessible for onclick handlers
window.Dashboard = Dashboard;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add some startup delay to ensure all resources are loaded
    setTimeout(() => {
        Dashboard.init();
    }, 100);
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add some startup delay to ensure all resources are loaded
    setTimeout(() => {
        Dashboard.init();
    }, 100);
});
