// Dashboard Forms - ปรับปรุงเพื่อรองรับ JSONP และการบันทึกรายงานการอบรม
// เพิ่มส่วนนี้ใน Dashboard object

Object.assign(Dashboard, {
    // Open training modal (ปรับปรุงแล้ว)
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

    // ⭐ Handle training form submit (ปรับปรุงสำหรับ JSONP)
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
            
            // Prepare data for submission (JSONP compatible)
            const reportData = {
                taskGid: formData.get('taskGid') || this.generateTaskGID(),
                knowledgeGained: formData.get('knowledgeGained').trim(),
                implementationPlan: formData.get('implementationPlan').trim(),
                knowledgeSharing: formData.get('knowledgeSharing').trim(),
                suggestionsImages: formData.get('suggestionsImages') ? formData.get('suggestionsImages').trim() : '',
                lineUid: formData.get('lineUid').trim(),
                timestamp: formData.get('timestamp') || new Date().toISOString()
            };
            
            console.log('Submitting training report via JSONP:', reportData);
            
            // Save to Google Sheets via JSONP
            const result = await API.saveTrainingReport(reportData);
            
            console.log('Training report save result:', result);
            
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

    // Mark task as complete (ปรับปรุงสำหรับ JSONP)
    markTaskComplete: async function(taskId) {
        Utils.showConfirm(
            'ยืนยันการทำเครื่องหมาย',
            'คุณต้องการทำเครื่องหมายงานนี้เป็นเสร็จสมบูรณ์หรือไม่?',
            async () => {
                try {
                    Utils.showLoading('กำลังอัปเดตสถานะ...');
                    
                    console.log('Updating task status via JSONP:', taskId);
                    await API.updateTaskStatus(taskId, 'Yes');
                    
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

    // Export data (ปรับปรุงสำหรับ JSONP)
    exportData: async function() {
        try {
            Utils.showLoading('กำลังเตรียมไฟล์ Excel...');
            
            const filters = this.getCurrentFilters();
            console.log('Exporting data via JSONP with filters:', filters);
            
            const result = await API.exportToExcel(filters);
            
            if (result.downloadUrl) {
                // Create download link
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
            throw error; // Re-throw for handling in event listener
        } finally {
            Utils.hideLoading();
        }
    },

    // Sync data from Asana (ปรับปรุงสำหรับ JSONP)
    syncData: async function() {
        Utils.showConfirm(
            'ยืนยันการซิงค์ข้อมูล',
            'คุณต้องการซิงค์ข้อมูลจาก Asana หรือไม่? การดำเนินการนี้อาจใช้เวลาสักครู่',
            async () => {
                try {
                    Utils.showLoading('กำลังซิงค์ข้อมูลจาก Asana...');
                    
                    console.log('Syncing data from Asana via JSONP...');
                    const result = await API.syncFromAsana();
                    
                    Utils.showSuccess(`ซิงค์ข้อมูลเรียบร้อย: อัปเดต ${result.updated || 0} รายการ`);
                    
                    // Refresh all data
                    await this.loadDashboardData();
                    
                } catch (error) {
                    console.error('Failed to sync data:', error);
                    throw error; // Re-throw for handling in event listener
                } finally {
                    Utils.hideLoading();
                }
            }
        );
    },

    // View reports (placeholder)
    viewReports: function() {
        Utils.showSuccess('ฟีเจอร์รายงานจะเปิดใช้งานในเร็วๆ นี้');
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

    // ⭐ Render stats cards (มาจาก dashboard-ui.js)
    renderStatsCards: function() {
        const statsSection = document.getElementById('stats-section');
        if (!statsSection || !dashboardData.stats) return;

        const stats = dashboardData.stats.summary;
        const cardsData = [
            {
                title: 'งานทั้งหมด',
                value: Utils.formatNumber(stats.totalTasks),
                icon: 'fas fa-tasks',
                color: 'blue',
                bgClass: 'stat-card'
            },
            {
                title: 'เสร็จสมบูรณ์',
                value: Utils.formatNumber(stats.completedTasks),
                icon: 'fas fa-check-circle',
                color: 'green',
                bgClass: 'stat-card'
            },
            {
                title: 'ยังไม่เสร็จ',
                value: Utils.formatNumber(stats.pendingTasks),
                icon: 'fas fa-clock',
                color: 'yellow',
                bgClass: 'stat-card yellow'
            },
            {
                title: 'งานปีนี้',
                value: Utils.formatNumber(stats.currentYearTasks),
                icon: 'fas fa-calendar-alt',
                color: 'blue',
                bgClass: 'stat-card white'
            },
            {
                title: 'งานเดือนนี้',
                value: Utils.formatNumber(stats.currentMonthTasks),
                icon: 'fas fa-calendar-day',
                color: 'blue',
                bgClass: 'stat-card'
            },
            {
                title: 'กำลังจะมาถึง',
                value: Utils.formatNumber(stats.upcomingTasks),
                icon: 'fas fa-exclamation-triangle',
                color: 'orange',
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

        // Add completion rate info
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

    // ⭐ Render monthly chart (placeholder - จะต้องเพิ่มฟังก์ชันนี้)
    renderMonthlyChart: function() {
        console.log('renderMonthlyChart called with data:', dashboardData.monthly);
        // TODO: Implement chart rendering
    },

    // ⭐ Render user chart (placeholder)
    renderUserChart: function() {
        console.log('renderUserChart called with data:', dashboardData.userStats);
        // TODO: Implement chart rendering
    },

    // ⭐ Render top users
    renderTopUsers: function() {
        const container = document.getElementById('top-users');
        if (!container || !dashboardData.userStats) return;

        const topUsers = dashboardData.userStats.slice(0, 5);

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

    // ⭐ Render upcoming tasks
    renderUpcomingTasks: function() {
        const container = document.getElementById('upcoming-tasks');
        if (!container || !dashboardData.upcomingTasks) return;

        const tasks = Array.isArray(dashboardData.upcomingTasks) 
            ? dashboardData.upcomingTasks 
            : dashboardData.upcomingTasks.data || [];

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
            const daysUntil = parseInt(task.daysUntilDue);
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

    // ⭐ Populate filter options
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
    }
});

// Make functions globally accessible for onclick handlers
window.Dashboard = Dashboard;
