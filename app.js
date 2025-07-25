// تهيئة Firebase
const firebaseConfig = {
    databaseURL: "https://pharmase-9d8bc-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// متغيرات التطبيق
let clientData = {};
let pharmacyId = null;
let currentUserType = null;
let selectedPharmacy = null;

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    loadSavedData();
    checkDarkModePreference();
    updateDateTime();
    initAnimations();
});

// تحميل البيانات المحفوظة
function loadSavedData() {
    // بيانات العميل
    const savedClientData = localStorage.getItem('clientData');
    if (savedClientData) {
        const data = JSON.parse(savedClientData);
        document.getElementById('client-name').value = data.name || '';
        document.getElementById('client-phone').value = data.phone || '';
        document.getElementById('client-city').value = data.city || '';
        document.getElementById('save-client-data').checked = true;
    }

    // بيانات الصيدلية
    const savedPharmacyData = localStorage.getItem('pharmacyData');
    if (savedPharmacyData) {
        const data = JSON.parse(savedPharmacyData);
        document.getElementById('pharmacy-name').value = data.name || '';
        document.getElementById('pharmacy-password').value = data.password || '';
        document.getElementById('save-pharmacy-data').checked = true;
    }
}

// عرض القسم المطلوب مع تأثيرات
function showSection(id) {
    // إخفاء جميع الأقسام
    document.querySelectorAll('.container').forEach(el => {
        if (!el.classList.contains('hidden')) {
            el.classList.add('fade-out');
            setTimeout(() => {
                el.classList.add('hidden');
                el.classList.remove('fade-out');
            }, 300);
        }
    });
    
    // عرض القسم المحدد
    const section = document.getElementById(id);
    section.classList.remove('hidden');
    setTimeout(() => {
        section.classList.add('fade-in');
    }, 50);
    
    // إدارة الحالة
    if (id === 'pharmacy-panel') {
        updatePharmacyStatus();
        loadPharmacyMedicines();
    }
    
    if (id === 'client-panel') {
        updateClientInfo();
        document.getElementById('pharmacy-details').classList.add('hidden');
        document.getElementById('pharmacies-results').classList.remove('hidden');
    }
    
    // التمرير لأعلى الصفحة
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// عرض نموذج تسجيل الصيدلية
function showRegisterForm() {
    const name = document.getElementById("pharmacy-name").value;
    const pass = document.getElementById("pharmacy-password").value;
    const saveData = document.getElementById("save-pharmacy-data").checked;
    
    document.getElementById("register-name").value = name || '';
    document.getElementById("register-password").value = pass || '';
    document.getElementById("save-register-data").checked = saveData;
    
    showSection("pharmacy-register");
}

// تسجيل دخول العميل
function loginClient() {
    const name = document.getElementById("client-name").value.trim();
    const phone = document.getElementById("client-phone").value.trim();
    const city = document.getElementById("client-city").value.trim();
    const saveData = document.getElementById("save-client-data").checked;

    if (!name || !phone || !city) {
        showError("الرجاء ملء جميع الحقول المطلوبة");
        return;
    }

    if (phone.length !== 11 || isNaN(phone)) {
        showError("رقم الهاتف يجب أن يكون 11 رقماً");
        return;
    }

    clientData = { name, phone, city };
    currentUserType = 'client';
    
    if (saveData) {
        localStorage.setItem('clientData', JSON.stringify(clientData));
    } else {
        localStorage.removeItem('clientData');
    }
    
    showSection("client-panel");
    showSuccess(`مرحباً ${name}! يمكنك الآن البحث عن الصيدليات في مدينة ${city}`);
}

// تسجيل دخول الصيدلية
function loginPharmacy() {
    const name = document.getElementById("pharmacy-name").value.trim();
    const pass = document.getElementById("pharmacy-password").value.trim();
    const saveData = document.getElementById("save-pharmacy-data").checked;

    if (!name || !pass) {
        showError("الرجاء إدخال جميع البيانات");
        return;
    }

    showLoading("جاري التحقق من بيانات الدخول...");

    db.ref("pharmacies").once("value", snap => {
        const data = snap.val();
        let pharmacyFound = false;

        for (let id in data) {
            if (data[id].name === name && data[id].password === pass) {
                pharmacyId = id;
                currentUserType = 'pharmacy';
                
                // تحديث آخر دخول
                db.ref("pharmacies/" + pharmacyId + "/lastLogin").set(firebase.database.ServerValue.TIMESTAMP);
                
                if (saveData) {
                    localStorage.setItem('pharmacyData', JSON.stringify({ name, password: pass }));
                } else {
                    localStorage.removeItem('pharmacyData');
                }
                
                showSection("pharmacy-panel");
                showSuccess(`مرحباً بك ${name}!`);
                pharmacyFound = true;
                return;
            }
        }

        if (!pharmacyFound) {
            showError("بيانات الدخول غير صحيحة");
        }
    }).catch(error => {
        showError("حدث خطأ أثناء محاولة الدخول");
        console.error(error);
    });
}

// تسجيل صيدلية جديدة
function registerPharmacy() {
    const name = document.getElementById("register-name").value.trim();
    const pass = document.getElementById("register-password").value.trim();
    const city = document.getElementById("register-city").value.trim();
    const location = document.getElementById("register-location").value.trim();
    const phone = document.getElementById("register-phone").value.trim();
    const saveData = document.getElementById("save-register-data").checked;

    if (!name || !pass || !city || !location) {
        showError("الرجاء ملء جميع الحقول المطلوبة");
        return;
    }

    showLoading("جاري إنشاء الحساب...");

    pharmacyId = Date.now().toString();
    currentUserType = 'pharmacy';

    db.ref("pharmacies/" + pharmacyId).set({
        name,
        password: pass,
        city,
        location,
        phone: phone || '',
        isOpen: true,
        medicines: {},
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastLogin: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        if (saveData) {
            localStorage.setItem('pharmacyData', JSON.stringify({ name, password: pass }));
        }
        
        showSection("pharmacy-panel");
        showSuccess(`تم إنشاء حساب جديد للصيدلية ${name}`);
    }).catch(error => {
        showError("حدث خطأ أثناء إنشاء الحساب");
        console.error(error);
    });
}

// تبديل حالة الصيدلية
function toggleOpen() {
    db.ref("pharmacies/" + pharmacyId + "/isOpen").transaction(currentStatus => {
        return currentStatus === true ? false : true;
    }, (error, committed) => {
        if (error) {
            showError("حدث خطأ أثناء تغيير الحالة");
        } else if (committed) {
            updatePharmacyStatus();
        }
    });
}

// تحديث حالة الصيدلية
function updatePharmacyStatus() {
    db.ref("pharmacies/" + pharmacyId + "/isOpen").on("value", snap => {
        const status = snap.val();
        const statusElement = document.getElementById("status-text");
        const statusBadge = document.getElementById("pharmacy-status");
        const toggleBtn = document.getElementById("toggle-status-btn");

        if (status) {
            statusElement.textContent = "مفتوحة الآن";
            statusBadge.className = "status-badge status-open";
            toggleBtn.innerHTML = '<i class="fas fa-door-open"></i> تغيير للإغلاق';
            toggleBtn.classList.remove('btn-closed');
            toggleBtn.classList.add('btn-open');
        } else {
            statusElement.textContent = "مغلقة الآن";
            statusBadge.className = "status-badge status-closed";
            toggleBtn.innerHTML = '<i class="fas fa-door-closed"></i> تغيير للفتح';
            toggleBtn.classList.remove('btn-open');
            toggleBtn.classList.add('btn-closed');
        }
    });
}

// البحث عن الصيدليات في المدينة
function searchPharmacies() {
    const searchTerm = document.getElementById("search-pharmacy").value.trim().toLowerCase();
    const city = clientData.city;

    if (!city) {
        showError("الرجاء تحديد المدينة أولاً");
        return;
    }

    showLoading("جاري البحث عن الصيدليات...");
    
    db.ref("pharmacies").once("value", snap => {
        const pharmacies = snap.val();
        let output = '';
        let foundPharmacies = 0;

        for (let id in pharmacies) {
            const p = pharmacies[id];
            
            // فلترة حسب المدينة والحالة
            if (p.city === city && p.isOpen) {
                // فلترة حسب اسم الصيدلية إذا كان هناك بحث
                if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) {
                    continue;
                }
                
                foundPharmacies++;
                
                output += `
                <div class="pharmacy-card" onclick="selectPharmacy('${id}', '${p.name}')">
                    <div class="pharmacy-header">
                        <div class="pharmacy-image">
                            <i class="fas fa-clinic-medical"></i>
                        </div>
                        <div class="pharmacy-info">
                            <h3>${p.name}</h3>
                            <div class="pharmacy-meta">
                                <span><i class="fas fa-map-marker-alt"></i> ${p.location ? '<a href="' + p.location + '" target="_blank">عرض الموقع</a>' : 'غير متاح'}</span>
                                <span><i class="fas fa-phone"></i> ${p.phone || 'غير متاح'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="pharmacy-status">
                        <span class="status-badge status-open">
                            <i class="fas fa-store"></i> مفتوحة الآن
                        </span>
                    </div>
                </div>`;
            }
        }

        if (foundPharmacies === 0) {
            output = `
            <div class="no-results">
                <i class="fas fa-search" style="font-size: 50px; color: #ccc;"></i>
                <h3>لا توجد صيدليات متاحة</h3>
                <p>لا توجد صيدليات متاحة حالياً في مدينة ${city}</p>
            </div>`;
        }

        document.getElementById("pharmacies-results").innerHTML = output;
    }).catch(error => {
        showError("حدث خطأ أثناء البحث عن الصيدليات");
        console.error(error);
    });
}

// اختيار صيدلية معينة
function selectPharmacy(pharmacyId, pharmacyName) {
    selectedPharmacy = { id: pharmacyId, name: pharmacyName };
    
    document.getElementById('selected-pharmacy-name').textContent = pharmacyName;
    document.getElementById('pharmacies-results').classList.add('hidden');
    document.getElementById('pharmacy-details').classList.remove('hidden');
    document.getElementById('medicine-results').innerHTML = '';
}

// الرجوع لقائمة الصيدليات
function backToPharmacies() {
    document.getElementById('pharmacy-details').classList.add('hidden');
    document.getElementById('pharmacies-results').classList.remove('hidden');
    document.getElementById('search-medicine-in-pharmacy').value = '';
}

// البحث عن دواء في الصيدلية المحددة
function searchMedicineInPharmacy() {
    const medicineName = document.getElementById("search-medicine-in-pharmacy").value.trim();
    
    if (!medicineName) {
        showError("الرجاء إدخال اسم الدواء");
        return;
    }

    if (!selectedPharmacy) {
        showError("الرجاء اختيار صيدلية أولاً");
        return;
    }

    showLoading("جاري البحث عن الدواء...");
    
    db.ref(`pharmacies/${selectedPharmacy.id}/medicines/${medicineName}`).once("value", snap => {
        const medicineData = snap.val();
        const resultsContainer = document.getElementById("medicine-results");
        let output = '';
        
        if (medicineData && medicineData.status === 'available') {
            output = `
            <div class="medicine-card">
                <div class="medicine-details">
                    <h3>${medicineName}</h3>
                    <div class="medicine-info">
                        <i class="fas fa-clinic-medical"></i>
                        <span>${selectedPharmacy.name}</span>
                    </div>
                    ${medicineData.price ? `
                    <div class="medicine-info">
                        <i class="fas fa-tag"></i>
                        <span>${medicineData.price} ${medicineData.currency || 'EGP'}</span>
                    </div>` : ''}
                    <div class="medicine-status available">
                        <i class="fas fa-check-circle"></i> متوفر
                    </div>
                    <button class="btn btn-call" onclick="makeCall('${selectedPharmacy.phone}')">
                        <i class="fas fa-phone"></i> اتصل بالصيدلية
                    </button>
                </div>
            </div>`;
        } else {
            output = `
            <div class="medicine-card">
                <div class="medicine-details" style="text-align: center;">
                    <i class="fas fa-search" style="font-size: 50px; color: #ccc;"></i>
                    <h3>${medicineName}</h3>
                    <p>هذا الدواء غير متوفر حالياً في ${selectedPharmacy.name}</p>
                    <div class="medicine-status not-available">
                        <i class="fas fa-times-circle"></i> غير متوفر
                    </div>
                </div>
            </div>`;
        }
        
        resultsContainer.innerHTML = output;
    }).catch(error => {
        showError("حدث خطأ أثناء البحث عن الدواء");
        console.error(error);
    });
}

// إضافة/تحديث دواء في الصيدلية
function addMedicine() {
    const name = document.getElementById("add-medicine-name").value.trim();
    const status = document.getElementById("add-medicine-status").value;
    const price = document.getElementById("add-medicine-price").value;
    const currency = document.getElementById("add-medicine-currency").value;

    if (!name) {
        showError("الرجاء إدخال اسم الدواء");
        return;
    }

    const medicineData = {
        status: status,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    if (price) {
        medicineData.price = price;
        medicineData.currency = currency;
    }

    db.ref("pharmacies/" + pharmacyId + "/medicines/" + name).set(medicineData)
        .then(() => {
            showSuccess(`تم ${status === 'available' ? 'إضافة' : 'تحديث'} الدواء "${name}"`);
            document.getElementById("add-medicine-name").value = '';
            document.getElementById("add-medicine-price").value = '';
            loadPharmacyMedicines();
        })
        .catch(error => {
            showError("حدث خطأ أثناء حفظ الدواء");
            console.error(error);
        });
}

// تحميل أدوية الصيدلية
function loadPharmacyMedicines() {
    db.ref("pharmacies/" + pharmacyId + "/medicines").once("value", snap => {
        const medicines = snap.val();
        const container = document.getElementById("medicines-list");
        container.innerHTML = '';

        if (medicines) {
            for (let name in medicines) {
                const medicine = medicines[name];
                container.innerHTML += `
                <div class="medicine-item">
                    <span>${name}</span>
                    <div>
                        <span class="status ${medicine.status === 'available' ? 'available' : 'not-available'}">
                            ${medicine.status === 'available' ? 'متوفر' : 'غير متوفر'}
                        </span>
                        ${medicine.price ? `<span class="price">${medicine.price} ${medicine.currency || 'EGP'}</span>` : ''}
                    </div>
                </div>`;
            }
        } else {
            container.innerHTML = '<p>لا توجد أدوية مسجلة بعد</p>';
        }
    });
}

// تحديث معلومات العميل
function updateClientInfo() {
    const clientInfo = document.getElementById("client-info");
    if (clientData.name && clientData.city) {
        clientInfo.innerHTML = `
            <div class="client-info-item">
                <i class="fas fa-user"></i> ${clientData.name}
            </div>
            <div class="client-info-item">
                <i class="fas fa-city"></i> ${clientData.city}
            </div>
            <div class="client-info-item">
                <i class="fas fa-phone"></i> ${clientData.phone}
            </div>`;
    }
}

// تغيير كلمة المرور
function changePassword() {
    const oldPass = document.getElementById("old-password").value;
    const newPass = document.getElementById("new-password").value;

    if (!oldPass || !newPass) {
        showError("الرجاء إدخال جميع الحقول");
        return;
    }

    if (newPass.length < 6) {
        showError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        return;
    }

    db.ref("pharmacies/" + pharmacyId + "/password").once("value", snap => {
        if (snap.val() === oldPass) {
            db.ref("pharmacies/" + pharmacyId + "/password").set(newPass)
                .then(() => {
                    // تحديث البيانات المحفوظة إذا كانت موجودة
                    const savedData = localStorage.getItem('pharmacyData');
                    if (savedData) {
                        const data = JSON.parse(savedData);
                        if (data.password === oldPass) {
                            data.password = newPass;
                            localStorage.setItem('pharmacyData', JSON.stringify(data));
                        }
                    }
                    
                    showSuccess("تم تغيير كلمة المرور بنجاح");
                    document.getElementById("old-password").value = '';
                    document.getElementById("new-password").value = '';
                    showSection("pharmacy-panel");
                })
                .catch(error => {
                    showError("حدث خطأ أثناء حفظ كلمة المرور الجديدة");
                    console.error(error);
                });
        } else {
            showError("كلمة المرور القديمة غير صحيحة");
        }
    });
}

// إجراء مكالمة هاتفية
function makeCall(phoneNumber) {
    if (confirm(`هل تريد الاتصال بالصيدلية على الرقم ${phoneNumber}؟`)) {
        window.open(`tel:${phoneNumber}`);
    }
}

// تسجيل الخروج
function logout() {
    if (currentUserType === 'pharmacy') {
        db.ref("pharmacies/" + pharmacyId + "/lastActivity").set(firebase.database.ServerValue.TIMESTAMP);
    }
    
    pharmacyId = null;
    clientData = {};
    currentUserType = null;
    selectedPharmacy = null;
    showSection('home-screen');
    showSuccess("تم تسجيل الخروج بنجاح");
}

// عرض رسالة نجاح
function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-check-circle"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// عرض رسالة خطأ
function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-exclamation-circle"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// عرض تحميل
function showLoading(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-loading';
    toast.innerHTML = `
        <div class="toast-icon">
            <div class="spinner"></div>
        </div>
        <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(toast);
    
    return toast;
}

// التحقق من تفضيل الوضع المظلم
function checkDarkModePreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
    }
}

// تحديث التاريخ والوقت
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('ar-EG', options);
    
    const dateElements = document.querySelectorAll('.current-date');
    dateElements.forEach(el => {
        el.textContent = dateString;
    });
}

// تهيئة تأثيرات الحركة
function initAnimations() {
    const animateOnScroll = () => {
        const elements = document.querySelectorAll('[data-aos]');
        elements.forEach(el => {
            const position = el.getBoundingClientRect();
            if (position.top < window.innerHeight * 0.75) {
                el.classList.add('aos-animate');
            }
        });
    };
    
    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll();
}
