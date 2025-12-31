// 1. ตั้งค่า Firebase (คงเดิม)
const firebaseConfig = {
  apiKey: "AIzaSyDRYTht-6h5QDqFTGO6sr44TfuvDfApAPc",
  authDomain: "box-return-system.firebaseapp.com",
  projectId: "box-return-system",
  storageBucket: "box-return-system.firebasestorage.app",
  messagingSenderId: "272291754420",
  appId: "1:272291754420:web:9ee1c794acbe190309c2e1",
  measurementId: "G-8PX3LBXM3L"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const storage = firebase.storage();

// 2. ฟังก์ชันทำงานเมื่อโหลดหน้าจอ
window.onload = async function() {
    const userPhone = localStorage.getItem('userPhone');
    const path = window.location.pathname.toLowerCase();

    const isLoginPage = path.includes('login.html');
    const isRegisterPage = path.includes('register.html');
    const isAdminPage = path.includes('admin');

    if (!userPhone && !isLoginPage && !isRegisterPage && !isAdminPage) {
        window.location.replace('login.html');
        return;
    }
    
    if (userPhone && (isLoginPage || isRegisterPage)) {
        window.location.replace('index.html');
        return;
    }

    if (userPhone) {
        await loadUserData(); // โหลดข้อมูลส่วนตัว
        
        // ถ้าอยู่หน้าประวัติ ให้ดึงประวัติจาก Firebase
        if (path.includes('history.html')) {
            fetchHistoryFromFirebase(userPhone); 
        }
    }
};

// 3-4. performRegister และ performLogin (ถูกต้องแล้ว)
async function performRegister() {
    const name = document.getElementById('regName').value;
    const faculty = document.getElementById('regFaculty').value;
    const year = document.getElementById('regYear').value;
    const phone = document.getElementById('regPhone').value;
    const pass = document.getElementById('regPassword').value;
    const confirmPass = document.getElementById('regConfirmPassword').value;

    if (!name || !faculty || !year || !phone || !pass) { 
        alert("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง"); return; 
    }

    const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
    if (!passRegex.test(pass)) {
        alert("รหัสผ่านต้องมีอักษร+ตัวเลข และยาวไม่เกิน 10 ตัว");
        return;
    }

    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name: name, faculty: faculty, year: year, phone: phone,
            password: pass, points: 0, returnCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        localStorage.setItem('userPhone', phone);
        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) { alert("สมัครไม่สำเร็จ: " + error.message); }
}

async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;
    if (!phone || !pass) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists && userDoc.data().password === pass) {
            localStorage.setItem('userPhone', phone);
            window.location.replace('index.html');
        } else { alert("เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง"); }
    } catch (error) { alert("เกิดข้อผิดพลาด: " + error.message); }
}

// 5. ดึงข้อมูลผู้ใช้ (อัปเกรดให้เสถียร)
async function loadUserData() {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) return;
    try {
        const userDoc = await db.collection("users").doc(userPhone).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            const setUI = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
            
            setUI('username', data.name);
            setUI('userphone', data.phone);
            setUI('userfaculty', data.faculty || '-');
            setUI('useryear', data.year || '-');
            setUI('points', data.points || 0);
            setUI('pointsDisplay', data.points || 0);
            setUI('returnCountDisplay', data.returnCount || 0);
        }
    } catch (e) { console.error("Load User Error:", e); }
}

// 6. ฟังก์ชันคืนกล่อง
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) { alert("กรุณาระบุข้อมูลให้ครบ"); return; }

    try {
        const storageRef = storage.ref(`returns/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(imageFile);
        const imageUrl = await storageRef.getDownloadURL();

        const transData = {
            boxId: boxId, userPhone: userPhone, type: 'return',
            imageUrl: imageUrl, date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection("transactions").add(transData);

        await db.collection("users").doc(userPhone).update({ 
            points: firebase.firestore.FieldValue.increment(5),
            returnCount: firebase.firestore.FieldValue.increment(1)
        });

        alert("คืนกล่องสำเร็จ! ได้รับ 5 แต้ม");
        window.location.replace('index.html');
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
}

// 7. ฟังก์ชันดึงประวัติจาก Firebase (ดีกว่าดึงจาก LocalStorage)
async function fetchHistoryFromFirebase(phone) {
    const container = document.getElementById('historyBox');
    if (!container) return;

    try {
        const snapshot = await db.collection("transactions")
            .where("userPhone", "==", phone)
            .orderBy("timestamp", "desc")
            .limit(20)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-state"><h3>ยังไม่มีข้อมูลการยืม-คืน</h3></div>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const item = doc.data();
            let icon = item.type === 'borrow' ? '📥' : '📤';
            let text = item.type === 'borrow' ? 'ยืมกล่อง' : 'คืนกล่อง';
            let color = item.type === 'borrow' ? '#4CAF50' : '#FF9800';
            html += `
            <div class="history-item" style="border-left: 5px solid ${color}; padding:10px; margin-bottom:10px; background:#f9f9f9; border-radius:4px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${icon} ${text}</strong>
                    <small style="color:#888;">${item.date}</small>
                </div>
                <div style="margin-top:5px; font-size:14px;">หมายเลข: <b>${item.boxId}</b></div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("Fetch History Error:", e);
        container.innerHTML = `<p>ไม่สามารถโหลดประวัติได้</p>`;
    }
}

function logout() {
    localStorage.clear();
    window.location.replace('login.html');
}
