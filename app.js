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
        listenToRequests();
        updatePharmacyStatus();
    }
    
    if (id === 'client-panel') {
        updateClientInfo();
    }
    
    // التمرير لأعلى الصفحة
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    showSuccess(`مرحباً ${name}! يمكنك الآن البحث عن الأدوية في صيدليات مدينة ${city}`);
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

// إنشاء حساب صيدلية جديد
function registerNewPharmacy() {
    const name = document.getElementById("pharmacy-name").value.trim();
    const pass = document.getElementById("pharmacy-password").value.trim();
    const saveData = document.getElementById("save-pharmacy-data").checked;

    if (!name || !pass) {
        showError("الرجاء إدخال اسم الصيدلية وكلمة المرور");
        return;
    }

    Swal.fire({
        title: 'تسجيل صيدلية جديدة',
        html:
            '<input id="swal-city" class="swal2-input" placeholder="المدينة">' +
            '<input id="swal-location" class="swal2-input" placeholder="رابط الموقع على الخريطة">' +
            '<input id="swal-phone" class="swal2-input" placeholder="رقم الهاتف (اختياري)">',
        focusConfirm: false,
        preConfirm: () => {
            return {
                city: document.getElementById('swal-city').value,
                location: document.getElementById('swal-location').value,
                phone: document.getElementById('swal-phone').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { city, location, phone } = result.value;
            
            if (!city || !location) {
                showError("المدينة ورابط الموقع مطلوبان");
                return;
            }

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

// البحث عن دواء
function searchMedicine() {
    const name = document.getElementById("search-medicine").value.trim();
    if (!name) {
        showError("الرجاء إدخال اسم الدواء");
        return;
    }

    if (!clientData.city) {
        showError("الرجاء تحديد المدينة أولاً");
        return;
    }

    const id = Date.now().toString();
    const requestData = {
        medicineName: name,
        city: clientData.city,
        phone: clientData.phone,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref("medicineRequests/" + id).set(requestData)
        .then(() => {
            showLoading("جاري البحث عن الدواء في صيدليات مدينتك...");
            displayMedicineResults(name);
        })
        .catch(error => {
            showError("حدث خطأ أثناء إرسال الطلب");
            console.error(error);
        });
}

// عرض نتائج البحث
function displayMedicineResults(medicineName) {
    const resultsContainer = document.getElementById("client-results");
    resultsContainer.innerHTML = '<div class="spinner"></div>';

    db.ref("pharmacies").on("value", snap => {
        const pharmacies = snap.val();
        let output = '';
        let availablePharmacies = 0;

        for (let id in pharmacies) {
            const p = pharmacies[id];
            if (p.city === clientData.city && p.isOpen && p.medicines && p.medicines[medicineName] && p.medicines[medicineName].status === 'available') {
                availablePharmacies++;
                const medicineData = p.medicines[medicineName];
                
                output += `
                <div class="medicine-card" data-aos="fade-up">
                    <div class="medicine-image">
                        <i class="fas fa-pills"></i>
                    </div>
                    <div class="medicine-details">
                        <h3>${medicineName}</h3>
                        <div class="medicine-info">
                            <i class="fas fa-clinic-medical"></i>
                            <span>${p.name}</span>
                        </div>
                        ${medicineData.price ? `
                        <div class="medicine-info">
                            <i class="fas fa-tag"></i>
                            <span>${medicineData.price} ${medicineData.currency || 'EGP'}</span>
                        </div>` : ''}
                        ${p.phone ? `
                        <div class="medicine-info">
                            <i class="fas fa-phone"></i>
                            <span><a href="tel:${p.phone}">${p.phone}</a></span>
                        </div>` : ''}
                        <div class="medicine-info">
                            <i class="fas fa-map-marker-alt"></i>
                            <span><a href="${p.location}" target="_blank">عرض الموقع</a></span>
                        </div>
                        <span class="availability-tag available">
                            <i class="fas fa-check-circle"></i> متوفر
                        </span>
                        <button class="btn btn-call" onclick="window.open('tel:${p.phone || ''}')">
                            <i class="fas fa-phone"></i> اتصل بالصيدلية
                        </button>
                    </div>
                </div>`;
            }
        }

        if (availablePharmacies === 0) {
            output = `
            <div class="medicine-card">
                <div class="medicine-details" style="text-align: center;">
                    <i class="fas fa-search" style="font-size: 50px; color: #ccc; margin-bottom: 15px;"></i>
                    <h3>${medicineName}</h3>
                    <p>لا توجد صيدليات متاحة حالياً تحتوي على هذا الدواء في مدينة ${clientData.city}</p>
                    <span class="availability-tag not-available">
                        <i class="fas fa-times-circle"></i> غير متوفر
                    </span>
                </div>
            </div>`;
        }

        resultsContainer.innerHTML = output;
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

// تحديث حالة توفر الدواء مع السعر
function setAvailability(medicineName, status, requestId) {
    Swal.fire({
        title: 'تحديث حالة الدواء',
        html: `
            <div style="text-align: right;">
                <p>${medicineName}</p>
                <input id="swal-price" class="swal2-input" placeholder="السعر (اختياري)" type="number">
                <select id="swal-currency" class="swal2-input">
                    <option value="EGP">جنيه مصري</option>
                    <option value="USD">دولار أمريكي</option>
                    <option value="SAR">ريال سعودي</option>
                </select>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'تأكيد',
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            return {
                price: document.getElementById('swal-price').value,
                currency: document.getElementById('swal-currency').value
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { price, currency } = result.value;
            const updateData = {
                status: status,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };

            if (price) {
                updateData.price = price;
                updateData.currency = currency;
            }

            db.ref("pharmacies/" + pharmacyId + "/medicines/" + medicineName).set(updateData)
                .then(() => {
                    if (requestId) {
                        db.ref("medicineRequests/" + requestId).remove();
                    }
                    showSuccess(`تم تحديث حالة "${medicineName}" إلى ${status === 'available' ? 'متوفر' : 'غير متوفر'}`);
                })
                .catch(error => {
                    showError("حدث خطأ أثناء تحديث حالة الدواء");
                    console.error(error);
                });
        }
    });
}

// إدارة طلبات الأدوية للصيدلية
function listenToRequests() {
    db.ref("medicineRequests").on("value", snap => {
        const data = snap.val();
        const container = document.getElementById("requests");
        container.innerHTML = '';

        db.ref("pharmacies/" + pharmacyId).once("value").then(pharmacySnap => {
            const pharmacy = pharmacySnap.val();
            let hasRequests = false;

            for (let rid in data) {
                const req = data[rid];
                if (req.city === pharmacy.city) {
                    hasRequests = true;
                    const requestTime = formatTime(req.timestamp);
                    
                    const div = document.createElement("div");
                    div.className = "medicine-card";
                    div.innerHTML = `
                        <div class="medicine-image" style="background: #f0f7fd;">
                            <i class="fas fa-search"></i>
                        </div>
                        <div class="medicine-details">
                            <h3>${req.medicineName}</h3>
                            <div class="medicine-info">
                                <i class="fas fa-user"></i>
                                <span>${req.phone}</span>
                            </div>
                            <div class="medicine-info">
                                <i class="fas fa-clock"></i>
                                <span>${requestTime}</span>
                            </div>
                            <div class="medicine-actions">
                                <button class="btn btn-primary" onclick="setAvailability('${req.medicineName}', 'available', '${rid}')">
                                    <i class="fas fa-check"></i> متوفر
                                </button>
                                <button class="btn btn-secondary" onclick="setAvailability('${req.medicineName}', 'not_available', '${rid}')">
                                    <i class="fas fa-times"></i> غير متوفر
                                </button>
                                <button class="btn btn-call" onclick="window.open('tel:${req.phone}')">
                                    <i class="fas fa-phone"></i> اتصل
                                </button>
                            </div>
                        </div>
                    `;
                    container.appendChild(div);
                }
            }

            if (!hasRequests) {
                container.innerHTML = `
                <div class="medicine-card">
                    <div class="medicine-details" style="text-align: center;">
                        <i class="fas fa-inbox" style="font-size: 50px; color: #ccc; margin-bottom: 15px;"></i>
                        <h3>لا توجد طلبات جديدة</h3>
                        <p>ستظهر هنا أي طلبات جديدة من العملاء في مدينتك</p>
                    </div>
                </div>`;
            }
        });
    });
}

// تسجيل الخروج
function logout() {
    if (currentUserType === 'pharmacy') {
        db.ref("pharmacies/" + pharmacyId + "/lastActivity").set(firebase.database.ServerValue.TIMESTAMP);
    }
    
    pharmacyId = null;
    clientData = {};
    currentUserType = null;
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

// تنسيق الوقت
function formatTime(timestamp) {
    if (!timestamp) return 'الآن';
    
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} يوم`;
    
    return date.toLocaleString('ar-EG');
}