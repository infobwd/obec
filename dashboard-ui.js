// Dashboard JavaScript - Modern Training Management System
// โรงเรียนบ้านวังด้ง - ส่วนที่ 2: UI และ Rendering Functions

// Extend Dashboard object with UI functions
Object.assign(Dashboard, {
    // Render statistics cards
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

    // Render monthly chart
    renderMonthlyChart: function() {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas || !dashboardData.monthly) return;

        const ctx = canvas.getContext('2d');
        const monthlyData = dashboardData.monthly.monthlyData;

        // Destroy existing chart
        if (charts.monthly) {
            charts.monthly.destroy();
        }

        // Populate year selector
        this.populateYearSelector();

        charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthlyData.map(item => item.month),
                datasets: [
                    {
                        label: 'เสร็จสมบูรณ์',
                        data: monthlyData.map(item => item.completed),
                        backgroundColor: CONFIG.CHART_COLORS.primary,
                        borderColor: CONFIG.CHART_COLORS.primary,
                        borderWidth: 1,
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: 'ยังไม่เสร็จ',
                        data: monthlyData.map(item => item.pending),
                        backgroundColor: CONFIG.CHART_COLORS.yellow,
                        borderColor: CONFIG.CHART_COLORS.yellow,
                        borderWidth: 1,
                        borderRadius: 8,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                family: 'Kanit',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            family: 'Kanit'
                        },
                        bodyFont: {
                            family: 'Kanit'
                        },
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${Utils.formatNumber(context.parsed.y)} งาน`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            font: {
                                family: 'Kanit'
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Kanit'
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    },

    // Render user performance chart
    renderUserChart: function() {
        const canvas = document.getElementById('userChart');
        if (!canvas || !dashboardData.userStats) return;

        const ctx = canvas.getContext('2d');
        const userStats = dashboardData.userStats.slice(0, 10); // Top 10 users

        // Destroy existing chart
        if (charts.user) {
            charts.user.destroy();
        }

        charts.user = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: userStats.map(user => user.assignee),
                datasets: [{
                    data: userStats.map(user => user.totalTasks),
                    backgroundColor: [
                        CONFIG.CHART_COLORS.primary,
                        CONFIG.CHART_COLORS.secondary,
                        CONFIG.CHART_COLORS.yellow,
                        CONFIG.CHART_COLORS.success,
                        CONFIG.CHART_COLORS.warning,
                        CONFIG.CHART_COLORS.danger,
                        '#8b5cf6',
                        '#06b6d4',
                        '#84cc16',
                        '#f97316'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: 'Kanit',
                                size: 11
                            },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        return {
                                            text: `${label} (${value})`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor,
                                            lineWidth: data.datasets[0].borderWidth,
                                            pointStyle: 'circle',
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            family: 'Kanit'
                        },
                        bodyFont: {
                            family: 'Kanit'
                        },
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${Utils.formatNumber(context.parsed)} งาน (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    },

    // Render top users list
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

    // Render upcoming tasks
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

    // Populate year selector
    populateYearSelector: function() {
        const yearSelector = document.getElementById('year-selector');
        if (!yearSelector) return;

        const currentYear = new Date().getFullYear() + 543;
        const years = [];
        
        // Generate years from 2565 to current year + 2
        for (let year = 2565; year <= currentYear + 2; year++) {
            years.push(year);
        }

        yearSelector.innerHTML = years.map(year => 
            `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
        ).join('');
    },

    // Populate filter options
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

    // Toggle chart type
    toggleChartType: function() {
        if (!charts.monthly) return;

        const currentType = charts.monthly.config.type;
        const newType = currentType === 'bar' ? 'line' : 'bar';
        
        charts.monthly.config.type = newType;
        
        if (newType === 'line') {
            charts.monthly.data.datasets.forEach(dataset => {
                dataset.fill = false;
                dataset.tension = 0.4;
                dataset.pointBackgroundColor = dataset.backgroundColor;
                dataset.pointBorderColor = dataset.borderColor;
                dataset.pointRadius = 5;
                dataset.pointHoverRadius = 7;
            });
        } else {
            charts.monthly.data.datasets.forEach(dataset => {
                dataset.borderRadius = 8;
                dataset.borderSkipped = false;
            });
        }
        
        charts.monthly.update();
    },

    // Load monthly chart with specific year
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

    // Load upcoming tasks with specific days
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
    },

    // Refresh all data
    refreshData: async function() {
        try {
            Utils.showLoading('กำลังรีเฟรชข้อมูล...');
            await this.loadDashboardData();
            Utils.showSuccess('รีเฟรชข้อมูลเรียบร้อย');
        } catch (error) {
            console.error('Failed to refresh data:', error);
            Utils.showError('ไม่สามารถรีเฟรชข้อมูลได้');
        }
    }
});

