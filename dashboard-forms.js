// Dashboard Forms - ปรับปรุงเพื่อรองรับการบันทึกรายงานการอบรม
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

    // ⭐ Handle training form submit (ปรับปรุงแล้ว)
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
            
            // Prepare data for submission
            const reportData = {
                taskGid: formData.get('taskGid') || this.generateTaskGID(),
                knowledgeGained: formData.get('knowledgeGained').trim(),
                implementationPlan: formData.get('implementationPlan').trim(),
                knowledgeSharing: formData.get('knowledgeSharing').trim(),
                suggestionsImages: formData.get('suggestionsImages') ? formData.get('suggestionsImages').trim() : '',
                lineUid: formData.get('lineUid').trim(),
                timestamp: formData.get('timestamp') || new Date().toISOString()
            };
            
            console.log('Submitting training report:', reportData);
            
            // Save to Google Sheets
            const result = await API.saveTrainingReport(reportData);
            
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

    // ⭐ Generate Task GID (ใหม่)
    generateTaskGID: function() {
        const timestamp = new Date().getTime();
        const random = Math.random().toString(36).substr(2, 5);
        return `TRN-${timestamp}-${random}`.toUpperCase();
    },

    // Load tasks table (ปรับปรุงแล้ว)
    loadTasksTable: async function() {
        try {
            Utils.showLoading('กำลังโหลดรายการงาน...');
            
            const filters = this.getCurrentFilters();
            const tasksData = await API.getTrainingTasks(filters);
            
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
                Utils.showError('ไม่สามารถโหลดรายการงานได้');
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
                task.name.toLowerCase().includes(searchTerm) ||
                task.assignee.toLowerCase().includes(searchTerm)
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

    // Mark task as complete (ปรับปรุงแล้ว)
    markTaskComplete: async function(taskId) {
        Utils.showConfirm(
            'ยืนยันการทำเครื่องหมาย',
            'คุณต้องการทำเครื่องหมายงานนี้เป็นเสร็จสมบูรณ์หรือไม่?',
            async () => {
                try {
                    Utils.showLoading('กำลังอัปเดตสถานะ...');
                    
                    await API.updateTaskStatus(taskId, 'Yes');
                    
                    Utils.showSuccess('อัปเดตสถานะเรียบร้อย');
                    await this.loadTasksTable();
                    await this.loadDashboardData();
                    
                } catch (error) {
                    console.error('Failed to update task status:', error);
                    
                    if (error.message.includes('เชื่อมต่อ') || error.message.includes('timeout')) {
                        Utils.showNetworkError();
                    } else {
                        Utils.showError('ไม่สามารถอัปเดตสถานะได้');
                    }
                } finally {
                    Utils.hideLoading();
                }
            }
        );
    },

    // Export data (ปรับปรุงแล้ว)
    exportData: async function() {
        try {
            Utils.showLoading('กำลังเตรียมไฟล์ Excel...');
            
            const filters = this.getCurrentFilters();
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

    // Sync data from Asana (ปรับปรุงแล้ว)
    syncData: async function() {
        Utils.showConfirm(
            'ยืนยันการซิงค์ข้อมูล',
            'คุณต้องการซิงค์ข้อมูลจาก Asana หรือไม่? การดำเนินการนี้อาจใช้เวลาสักครู่',
            async () => {
                try {
                    Utils.showLoading('กำลังซิงค์ข้อมูลจาก Asana...');
                    
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
    }
});

// Make functions globally accessible for onclick handlers
window.Dashboard = Dashboard;