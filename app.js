// Invoices
    loadInvoicesTable() {
        const invoices = this.getData('invoices');
        const carriers = this.getData('carriers');
        const brokers = this.getData('brokers');
        const tbody = document.getElementById('invoicesTableBody');
        
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No invoices found. Create your first invoice.</td></tr>';
            return;
        }
        
        tbody.innerHTML = invoices.map(inv => {
            const carrier = carriers.find(c => c.id === inv.carrierId);
            const broker = brokers.find(b => b.id === inv.brokerId);
            const statusBadge = {
                'pending': '<span class="badge badge-warning">Pending</span>',
                'paid': '<span class="badge badge-success">Paid</span>',
                'bad_debt': '<span class="badge badge-danger">Bad Debt</span>'
            }[inv.status] || '<span class="badge badge-info">Unknown</span>';
            
            return `
                <tr>
                    <td>${inv.invoiceNumber}</td>
                    <td>${inv.loadNumber}</td>
                    <td>${carrier?.name || '-'}</td>
                    <td>${broker?.name || '-'}</td>
                    <td>${this.formatCurrency(inv.loadValue)}</td>
                    <td>${this.formatCurrency(inv.fundedAmount)}</td>
                    <td>${statusBadge}</td>
                    <td>${this.formatDate(inv.createdAt)}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="app.editInvoice('${inv.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteInvoice('${inv.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    showInvoiceForm(id = null) {
        const invoice = id ? this.getData('invoices').find(i => i.id === id) : {};
        const carriers = this.getData('carriers');
        const brokers = this.getData('brokers');
        const title = id ? 'Edit Invoice' : 'Create New Invoice';
        
        const html = `
            <form id="invoiceForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Invoice Number *</label>
                        <input type="text" name="invoiceNumber" value="${invoice.invoiceNumber || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Load Number *</label>
                        <input type="text" name="loadNumber" value="${invoice.loadNumber || ''}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Carrier *</label>
                        <select name="carrierId" required>
                            <option value="">Select Carrier</option>
                            ${carriers.map(c => `<option value="${c.id}" ${invoice.carrierId === c.id ? 'selected' : ''}>${c.name} (DOT: ${c.dot})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Broker *</label>
                        <select name="brokerId" required>
                            <option value="">Select Broker</option>
                            ${brokers.map(b => `<option value="${b.id}" ${invoice.brokerId === b.id ? 'selected' : ''}>${b.name} (MC: ${b.mc})</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Load Value *</label>
                        <input type="number" name="loadValue" step="0.01" value="${invoice.loadValue || ''}" required id="loadValue">
                    </div>
                    <div class="form-group">
                        <label>Fuel Advance</label>
                        <input type="number" name="fuelAdvance" step="0.01" value="${invoice.fuelAdvance || 0}" id="fuelAdvance">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Factoring Fee (%)</label>
                        <input type="number" name="factoringFeePercent" step="0.01" value="${invoice.factoringFeePercent || 3}" id="factoringFeePercent">
                    </div>
                    <div class="form-group">
                        <label>Transaction Fee Type</label>
                        <select name="transactionFeeType" id="transactionFeeType">
                            <option value="ach" ${invoice.transactionFeeType === 'ach' ? 'selected' : ''}>ACH ($1)</option>
                            <option value="wire" ${invoice.transactionFeeType === 'wire' ? 'selected' : ''}>Wire ($30)</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Special Discounts/Adjustments</label>
                    <input type="number" name="specialDiscounts" step="0.01" value="${invoice.specialDiscounts || 0}" id="specialDiscounts">
                </div>
                <div style="background: #EDF2F7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <h4 style="margin-bottom: 10px;">Calculation Summary</h4>
                    <div id="calculationSummary">
                        <p>Loading calculation...</p>
                    </div>
                </div>
            </form>
        `;
        
        this.showModal(title, html, () => this.saveInvoice(id));
        
        setTimeout(() => {
            ['loadValue', 'fuelAdvance', 'factoringFeePercent', 'transactionFeeType', 'specialDiscounts'].forEach(field => {
                document.getElementById(field).addEventListener('input', () => this.updateInvoiceCalculation());
            });
            this.updateInvoiceCalculation();
        }, 100);
    },
    
    updateInvoiceCalculation() {
        const loadValue = parseFloat(document.getElementById('loadValue').value) || 0;
        const fuelAdvance = parseFloat(document.getElementById('fuelAdvance').value) || 0;
        const factoringFeePercent = parseFloat(document.getElementById('factoringFeePercent').value) || 0;
        const transactionFeeType = document.getElementById('transactionFeeType').value;
        const specialDiscounts = parseFloat(document.getElementById('specialDiscounts').value) || 0;
        
        const transactionFee = transactionFeeType === 'ach' ? 1 : 30;
        const baseAmount = loadValue - fuelAdvance;
        const factoringFee = (baseAmount * factoringFeePercent) / 100;
        const fundedAmount = baseAmount - factoringFee - transactionFee - specialDiscounts;
        
        document.getElementById('calculationSummary').innerHTML = `
            <p><strong>Load Value:</strong> ${this.formatCurrency(loadValue)}</p>
            <p><strong>Fuel Advance:</strong> -${this.formatCurrency(fuelAdvance)}</p>
            <p><strong>Base Amount:</strong> ${this.formatCurrency(baseAmount)}</p>
            <hr style="margin: 10px 0;">
            <p><strong>Factoring Fee (${factoringFeePercent}%):</strong> -${this.formatCurrency(factoringFee)}</p>
            <p><strong>Transaction Fee:</strong> -${this.formatCurrency(transactionFee)}</p>
            <p><strong>Special Discounts:</strong> -${this.formatCurrency(specialDiscounts)}</p>
            <hr style="margin: 10px 0;">
            <p style="font-size: 18px; color: #6B46C1;"><strong>Funded Amount:</strong> ${this.formatCurrency(fundedAmount)}</p>
        `;
    },
    
    saveInvoice(id) {
        const form = document.getElementById('invoiceForm');
        const formData = new FormData(form);
        const invoices = this.getData('invoices');
        
        const loadValue = parseFloat(formData.get('loadValue')) || 0;
        const fuelAdvance = parseFloat(formData.get('fuelAdvance')) || 0;
        const factoringFeePercent = parseFloat(formData.get('factoringFeePercent')) || 0;
        const transactionFeeType = formData.get('transactionFeeType');
        const specialDiscounts = parseFloat(formData.get('specialDiscounts')) || 0;
        
        const transactionFee = transactionFeeType === 'ach' ? 1 : 30;
        const baseAmount = loadValue - fuelAdvance;
        const factoringFee = (baseAmount * factoringFeePercent) / 100;
        const fundedAmount = baseAmount - factoringFee - transactionFee - specialDiscounts;
        
        const invoice = {
            id: id || this.generateId(),
            invoiceNumber: formData.get('invoiceNumber'),
            loadNumber: formData.get('loadNumber'),
            carrierId: formData.get('carrierId'),
            brokerId: formData.get('brokerId'),
            loadValue,
            fuelAdvance,
            factoringFeePercent,
            factoringFee,
            transactionFeeType,
            transactionFee,
            specialDiscounts,
            fundedAmount,
            status: 'pending',
            createdAt: id ? invoices.find(i => i.id === id).createdAt : new Date().toISOString()
        };
        
        if (id) {
            const index = invoices.findIndex(i => i.id === id);
            invoices[index] = invoice;
        } else {
            invoices.push(invoice);
        }
        
        this.setData('invoices', invoices);
        this.closeModal();
        this.loadInvoicesTable();
        this.updateKPIs();
        this.showAlert(id ? 'Invoice updated' : 'Invoice created');
    },
    
    editInvoice(id) {
        this.showInvoiceForm(id);
    },
    
    deleteInvoice(id) {
        if (confirm('Delete this invoice?')) {
            const invoices = this.getData('invoices').filter(i => i.id !== id);
            this.setData('invoices', invoices);
            this.loadInvoicesTable();
            this.updateKPIs();
            this.showAlert('Invoice deleted');
        }
    },
    
    // Reserve
    loadReserveTable() {
        const reserves = this.getData('reserves');
        const carriers = this.getData('carriers');
        const tbody = document.getElementById('reserveTableBody');
        
        if (reserves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No reserve entries found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = reserves.map(r => {
            const carrier = carriers.find(c => c.id === r.carrierId);
            const statusBadge = r.status === 'active' ? '<span class="badge badge-warning">Active</span>' : '<span class="badge badge-success">Liquidated</span>';
            
            return `
                <tr>
                    <td>${carrier?.name || '-'}</td>
                    <td>${r.invoiceNumber || '-'}</td>
                    <td>${this.formatCurrency(r.amount)}</td>
                    <td>${r.reason}</td>
                    <td>${this.formatDate(r.createdAt)}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${r.status === 'active' ? `<button class="btn btn-sm btn-success" onclick="app.liquidateReserve('${r.id}')">Liquidate</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="app.deleteReserve('${r.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    showReserveForm() {
        const carriers = this.getData('carriers');
        
        const html = `
            <form id="reserveForm">
                <div class="form-group">
                    <label>Carrier *</label>
                    <select name="carrierId" required>
                        <option value="">Select Carrier</option>
                        ${carriers.map(c => `<option value="${c.id}">${c.name} (DOT: ${c.dot})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Invoice Number</label>
                    <input type="text" name="invoiceNumber" placeholder="Related invoice (optional)">
                </div>
                <div class="form-group">
                    <label>Amount *</label>
                    <input type="number" name="amount" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Reason *</label>
                    <select name="reason" required>
                        <option value="">Select Reason</option>
                        <option value="Broker non-payment">Broker non-payment</option>
                        <option value="Direct payment to carrier">Direct payment to carrier</option>
                        <option value="Dispute">Dispute</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </form>
        `;
        
        this.showModal('Create Reserve Entry', html, () => this.saveReserve());
    },
    
    saveReserve() {
        const form = document.getElementById('reserveForm');
        const formData = new FormData(form);
        const reserves = this.getData('reserves');
        
        const reserve = {
            id: this.generateId(),
            carrierId: formData.get('carrierId'),
            invoiceNumber: formData.get('invoiceNumber'),
            amount: parseFloat(formData.get('amount')),
            reason: formData.get('reason'),
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        reserves.push(reserve);
        this.setData('reserves', reserves);
        this.closeModal();
        this.loadReserveTable();
        this.updateKPIs();
        this.showAlert('Reserve entry created');
    },
    
    liquidateReserve(id) {
        if (confirm('Mark this reserve as liquidated?')) {
            const reserves = this.getData('reserves');
            const reserve = reserves.find(r => r.id === id);
            if (reserve) {
                reserve.status = 'liquidated';
                reserve.liquidatedAt = new Date().toISOString();
                this.setData('reserves', reserves);
                this.loadReserveTable();
                this.updateKPIs();
                this.showAlert('Reserve liquidated');
            }
        }
    },
    
    deleteReserve(id) {
        if (confirm('Delete this reserve entry?')) {
            const reserves = this.getData('reserves').filter(r => r.id !== id);
            this.setData('reserves', reserves);
            this.loadReserveTable();
            this.updateKPIs();
            this.showAlert('Reserve entry deleted');
        }
    },
    
    // Unfactored
    loadUnfactoredTable() {
        const unfactored = this.getData('unfactored');
        const tbody = document.getElementById('unfactoredTableBody');
        
        const total = unfactored.filter(u => u.status === 'pending').reduce((sum, u) => sum + (u.amount || 0), 0);
        document.getElementById('totalUnfactoredBalance').textContent = this.formatCurrency(total);
        
        if (unfactored.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No unfactored entries found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = unfactored.map(u => {
            const statusBadge = u.status === 'pending' ? '<span class="badge badge-warning">Pending</span>' : '<span class="badge badge-success">Reconciled</span>';
            
            return `
                <tr>
                    <td>${this.formatDate(u.date)}</td>
                    <td>${this.formatCurrency(u.amount)}</td>
                    <td><span class="badge badge-info">${u.type}</span></td>
                    <td>${u.reference || '-'}</td>
                    <td>${u.memo || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${u.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="app.reconcileUnfactored('${u.id}')">Reconcile</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="app.deleteUnfactored('${u.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    showUnfactoredForm() {
        const html = `
            <form id="unfactoredForm">
                <div class="form-row">
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Amount *</label>
                        <input type="number" name="amount" step="0.01" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Type *</label>
                    <select name="type" required>
                        <option value="">Select Type</option>
                        <option value="Unidentified Payment">Unidentified Payment</option>
                        <option value="Overpayment">Overpayment</option>
                        <option value="Duplicate Payment">Duplicate Payment</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Reference</label>
                    <input type="text" name="reference" placeholder="Check #, Wire ref, etc.">
                </div>
                <div class="form-group">
                    <label>Memo</label>
                    <textarea name="memo"></textarea>
                </div>
            </form>
        `;
        
        this.showModal('Add Unfactored Entry', html, () => this.saveUnfactored());
    },
    
    saveUnfactored() {
        const form = document.getElementById('unfactoredForm');
        const formData = new FormData(form);
        const unfactored = this.getData('unfactored');
        
        const entry = {
            id: this.generateId(),
            date: formData.get('date'),
            amount: parseFloat(formData.get('amount')),
            type: formData.get('type'),
            reference: formData.get('reference'),
            memo: formData.get('memo'),
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        unfactored.push(entry);
        this.setData('unfactored', unfactored);
        this.closeModal();
        this.loadUnfactoredTable();
        this.updateKPIs();
        this.showAlert('Unfactored entry added');
    },
    
    reconcileUnfactored(id) {
        if (confirm('Mark this entry as reconciled?')) {
            const unfactored = this.getData('unfactored');
            const entry = unfactored.find(u => u.id === id);
            if (entry) {
                entry.status = 'reconciled';
                entry.reconciledAt = new Date().toISOString();
                this.setData('unfactored', unfactored);
                this.loadUnfactoredTable();
                this.updateKPIs();
                this.showAlert('Entry reconciled');
            }
        }
    },
    
    deleteUnfactored(id) {
        if (confirm('Delete this unfactored entry?')) {
            const unfactored = this.getData('unfactored').filter(u => u.id !== id);
            this.setData('unfactored', unfactored);
            this.loadUnfactoredTable();
            this.updateKPIs();
            this.showAlert('Entry deleted');
        }
    },
    
    // Collections
    loadCollectionsData() {
        this.loadARByBroker();
        this.loadOutstandingInvoices();
    },
    
    loadARByBroker() {
        const brokers = this.getData('brokers');
        const invoices = this.getData('invoices');
        const tbody = document.getElementById('arByBrokerTableBody');
        
        const brokerAR = brokers.map(broker => {
            const brokerInvoices = invoices.filter(i => i.brokerId === broker.id && i.status === 'pending');
            
            const current = this.calculateAgingBucket(brokerInvoices, 0, 30);
            const days30 = this.calculateAgingBucket(brokerInvoices, 31, 60);
            const days60 = this.calculateAgingBucket(brokerInvoices, 61, 90);
            const days90Plus = this.calculateAgingBucket(brokerInvoices, 91, 999);
            const total = current + days30 + days60 + days90Plus;
            
            return { broker, current, days30, days60, days90Plus, total };
        }).filter(b => b.total > 0);
        
        if (brokerAR.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No outstanding A/R</td></tr>';
            return;
        }
        
        tbody.innerHTML = brokerAR.map(data => `
            <tr>
                <td>${data.broker.name}</td>
                <td><strong>${this.formatCurrency(data.total)}</strong></td>
                <td>${this.formatCurrency(data.current)}</td>
                <td>${this.formatCurrency(data.days30)}</td>
                <td>${this.formatCurrency(data.days60)}</td>
                <td style="color: #E53E3E;"><strong>${this.formatCurrency(data.days90Plus)}</strong></td>
                <td><button class="btn btn-sm btn-secondary" onclick="alert('View broker invoices')">View</button></td>
            </tr>
        `).join('');
    },
    
    calculateAgingBucket(invoices, minDays, maxDays) {
        return invoices.filter(inv => {
            const days = this.getDaysOutstanding(inv.createdAt);
            return days >= minDays && days <= maxDays;
        }).reduce((sum, inv) => sum + (inv.loadValue || 0), 0);
    },
    
    getDaysOutstanding(createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        return Math.floor((now - created) / (1000 * 60 * 60 * 24));
    },
    
    loadOutstandingInvoices() {
        const invoices = this.getData('invoices').filter(i => i.status === 'pending');
        const brokers = this.getData('brokers');
        const tbody = document.getElementById('outstandingInvoicesTableBody');
        
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No outstanding invoices</td></tr>';
            return;
        }
        
        tbody.innerHTML = invoices.map(inv => {
            const broker = brokers.find(b => b.id === inv.brokerId);
            const days = this.getDaysOutstanding(inv.createdAt);
            const statusBadge = days > 90 ? '<span class="badge badge-danger">Bad Debt</span>' :
                days > 60 ? '<span class="badge badge-danger">Overdue</span>' :
                days > 30 ? '<span class="badge badge-warning">Past Due</span>' :
                '<span class="badge badge-info">Current</span>';
            
            return `
                <tr>
                    <td>${inv.invoiceNumber}</td>
                    <td>${broker?.name || '-'}</td>
                    <td>${this.formatCurrency(inv.loadValue)}</td>
                    <td>${days} days</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="app.markInvoicePaid('${inv.id}')">Mark Paid</button>
                        ${days > 90 ? `<button class="btn btn-sm btn-danger" onclick="app.markInvoiceBadDebt('${inv.id}')">Bad Debt</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    markInvoicePaid(id) {
        if (confirm('Mark this invoice as paid?')) {
            const invoices = this.getData('invoices');
            const invoice = invoices.find(i => i.id === id);
            if (invoice) {
                invoice.status = 'paid';
                invoice.paidAt = new Date().toISOString();
                this.setData('invoices', invoices);
                this.loadCollectionsData();
                this.updateKPIs();
                this.showAlert('Invoice marked as paid');
            }
        }
    },
    
    markInvoiceBadDebt(id) {
        if (confirm('Mark this invoice as bad debt?')) {
            const invoices = this.getData('invoices');
            const invoice = invoices.find(i => i.id === id);
            if (invoice) {
                invoice.status = 'bad_debt';
                invoice.badDebtAt = new Date().toISOString();
                this.setData('invoices', invoices);
                this.loadCollectionsData();
                this.updateKPIs();
                this.showAlert('Invoice marked as bad debt', 'danger');
            }
        }
    },
    
    // Reports
    generateReport(type, format) {
        switch(type) {
            case 'dailyFunding':
                this.generateDailyFundingReport(format);
                break;
            case 'fees':
                this.generateFeesReport(format);
                break;
            case 'reserve':
                this.generateReserveReport(format);
                break;
            case 'unfactored':
                this.exportToCSV(this.getData('unfactored'), 'Unfactored_Report.csv');
                break;
            case 'ar':
                alert('A/R Report - Use Collections section to view details');
                break;
            case 'badDebt':
                const badDebt = this.getData('invoices').filter(i => i.status === 'bad_debt');
                this.exportToCSV(badDebt, 'Bad_Debt_Report.csv');
                break;
        }
    },
    
    generateDailyFundingReport(format) {
        const date = document.getElementById('dailyFundingDate').value || new Date().toISOString().split('T')[0];
        const invoices = this.getData('invoices').filter(i => i.createdAt?.startsWith(date));
        
        if (invoices.length === 0) {
            this.showAlert('No invoices found for selected date', 'warning');
            return;
        }
        
        const brokers = this.getData('brokers');
        const carriers = this.getData('carriers');
        const entries = [];
        
        invoices.forEach(inv => {
            const carrier = carriers.find(c => c.id === inv.carrierId);
            const broker = brokers.find(b => b.id === inv.brokerId);
            
            entries.push({
                Date: date,
                Account: `A/R - ${broker?.name || 'Unknown'}`,
                Debit: inv.loadValue,
                Credit: '',
                Memo: `Invoice ${inv.invoiceNumber} - Load ${inv.loadNumber}`
            });
            
            entries.push({
                Date: date,
                Account: 'Factoring Fee Revenue',
                Debit: '',
                Credit: inv.factoringFee,
                Memo: `Fee on Invoice ${inv.invoiceNumber}`
            });
            
            entries.push({
                Date: date,
                Account: 'Transaction Fee Revenue',
                Debit: '',
                Credit: inv.transactionFee,
                Memo: `Transaction fee on Invoice ${inv.invoiceNumber}`
            });
            
            entries.push({
                Date: date,
                Account: 'Cash - Operating Account',
                Debit: '',
                Credit: inv.fundedAmount,
                Memo: `Funded to ${carrier?.name || 'Unknown'} - Invoice ${inv.invoiceNumber}`
            });
        });
        
        this.exportToCSV(entries, `Daily_Funding_${date}.csv`);
    },
    
    generateFeesReport(format) {
        const startDate = document.getElementById('feesStartDate').value;
        const endDate = document.getElementById('feesEndDate').value;
        
        if (!startDate || !endDate) {
            this.showAlert('Please select date range', 'warning');
            return;
        }
        
        const invoices = this.getData('invoices').filter(inv => {
            const invDate = inv.createdAt.split('T')[0];
            return invDate >= startDate && invDate <= endDate;
        });
        
        const carriers = this.getData('carriers');
        const brokers = this.getData('brokers');
        
        const fees = invoices.map(inv => {
            const carrier = carriers.find(c => c.id === inv.carrierId);
            const broker = brokers.find(b => b.id === inv.brokerId);
            
            return {
                Date: inv.createdAt.split('T')[0],
                'Invoice Number': inv.invoiceNumber,
                'Load Number': inv.loadNumber,
                Carrier: carrier?.name || '-',
                Broker: broker?.name || '-',
                'Load Value': inv.loadValue,
                'Factoring Fee %': inv.factoringFeePercent,
                'Factoring Fee $': inv.factoringFee,
                'Transaction Fee': inv.transactionFee,
                'Total Fees': inv.factoringFee + inv.transactionFee
            };
        });
        
        this.exportToCSV(fees, `Fees_Report_${startDate}_to_${endDate}.csv`);
    },
    
    generateReserveReport(format) {
        const reserves = this.getData('reserves').filter(r => r.status === 'active');
        const carriers = this.getData('carriers');
        
        const reservesByCarrier = {};
        
        reserves.forEach(reserve => {
            const carrier = carriers.find(c => c.id === reserve.carrierId);
            const carrierName = carrier?.name || 'Unknown';
            
            if (!reservesByCarrier[carrierName]) {
                reservesByCarrier[carrierName] = {
                    Carrier: carrierName,
                    'DOT Number': carrier?.dot || '-',
                    'Total Reserve': 0,
                    'Number of Entries': 0
                };
            }
            
            reservesByCarrier[carrierName]['Total Reserve'] += reserve.amount;
            reservesByCarrier[carrierName]['Number of Entries']++;
        });
        
        const data = Object.values(reservesByCarrier);
        this.exportToCSV(data, 'Reserve_Report.csv');
    },
    
    exportToCSV(data, filename) {
        if (data.length === 0) {
            this.showAlert('No data to export', 'warning');
            return;
        }
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
                }).join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showAlert('Report exported successfully');
    },
    
    // Modal
    showModal(title, content, onSave) {
        const html = `
            <div class="modal-overlay" id="modalOverlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" onclick="app.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">${content}</div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                        <button class="btn btn-primary" id="modalSaveBtn">Save</button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('modalContainer').innerHTML = html;
        
        if (onSave) {
            document.getElementById('modalSaveBtn').addEventListener('click', onSave);
        }
    },
    
    closeModal() {
        document.getElementById('modalContainer').innerHTML = '';
    },
    
    showAlert(message, type = 'success') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.position = 'fixed';
        alert.style.top = '20px';
        alert.style.right = '20px';
        alert.style.zIndex = '9999';
        alert.style.padding = '15px 20px';
        alert.style.borderRadius = '8px';
        alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        alert.style.backgroundColor = type === 'success' ? '#C6F6D5' : type === 'danger' ? '#FED7D7' : '#FEEBC8';
        alert.style.color = type === 'success' ? '#22543D' : type === 'danger' ? '#742A2A' : '#7C2D12';
        
        document.body.appendChild(alert);
        
        setTimeout(() => alert.remove(), 3000);
    },
    
    // Event Listeners
    initEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const role = document.getElementById('loginRole').value;
            
            if (!this.login(username, password, role)) {
                this.showAlert('Invalid credentials (username must equal password)', 'danger');
            }
        });
        
        // Logout
        document.getElementById('btnLogout').addEventListener('click', () => this.logout());
        
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(e.target.dataset.section);
            });
        });
        
        // Carriers
        document.getElementById('btnAddCarrier').addEventListener('click', () => this.showCarrierForm());
        document.getElementById('btnImportCarriers').addEventListener('click', () => alert('Import CSV feature - Upload carriers.csv'));
        
        // Brokers
        document.getElementById('btnAddBroker').addEventListener('click', () => this.showBrokerForm());
        document.getElementById('btnImportBrokers').addEventListener('click', () => alert('Import CSV feature - Upload brokers.csv'));
        
        // Invoices
        document.getElementById('btnAddInvoice').addEventListener('click', () => this.showInvoiceForm());
        
        // Reserve
        document.getElementById('btnAddReserve').addEventListener('click', () => this.showReserveForm());
        
        // Unfactored
        document.getElementById('btnAddUnfactored').addEventListener('click', () => this.showUnfactoredForm());
        
        // Collections
        document.getElementById('btnImportPayments').addEventListener('click', () => alert('Import Payments CSV feature'));
        
        // Global Search
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length > 2) {
                this.performGlobalSearch(query);
            } else {
                document.getElementById('searchResults').classList.add('hidden');
            }
        });
    },
    
    performGlobalSearch(query) {
        const carriers = this.getData('carriers');
        const invoices = this.getData('invoices');
        const results = [];
        
        carriers.forEach(c => {
            if (c.name.toLowerCase().includes(query) || c.dot?.includes(query)) {
                results.push(`Carrier: ${c.name} (DOT: ${c.dot})`);
            }
        });
        
        invoices.forEach(i => {
            if (i.invoiceNumber.toLowerCase().includes(query) || i.loadNumber.toLowerCase().includes(query)) {
                results.push(`Invoice: ${i.invoiceNumber} - Load: ${i.loadNumber}`);
            }
        });
        
        const searchDiv = document.getElementById('searchResults');
        if (results.length > 0) {
            searchDiv.innerHTML = results.slice(0, 5).map(r => `<div style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${r}</div>`).join('');
            searchDiv.classList.remove('hidden');
        } else {
            searchDiv.innerHTML = '<div style="padding: 10px;">No results found</div>';
            searchDiv.classList.remove('hidden');
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
