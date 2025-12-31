// 1. ตั้งค่า Firebase
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

// 2. ฟังก์ชันตรวจสอบสิทธิ์เมื่อโหลดหน้าจอ
window.onload = function() {
            // --- ส่วนเดิมของคุณ ---
            const historyData = JSON.parse(localStorage.getItem('borrowHistory')) || [];
            const container = document.getElementById('historyBox');

            // --- เพิ่มส่วนนี้: ดึงจำนวนครั้งจาก LocalStorage มาโชว์ ---
            const count = localStorage.getItem('returnCount') || '0';
            if (document.getElementById('returnCountDisplay')) {
                document.getElementById('returnCountDisplay').innerText = count;
            }

            // --- Logic แสดงรายการประวัติเดิมของคุณ ---
            if (historyData.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">📭</span>
                        <h3>คุณยังไม่เคยยืมกล่องกับเรา</h3>
                        <p style="font-size:14px;">เริ่มยืมครั้งแรกได้ที่เมนู "ยืม"</p>
                        <button onclick="location.href='scan_borrow.html'" style="width:auto; margin-top:10px; font-size:14px;">
                            ไปที่หน้ายืม
                        </button>
                    </div>
                `;
            } else {
                let html = '';
                historyData.slice().reverse().forEach(item => {
                    let statusColor = item.type === 'borrow' ? '#e8f5e9' : '#fff3e0';
                    let icon = item.type === 'borrow' ? '📥' : '📤';
                    let text = item.type === 'borrow' ? 'ยืมกล่อง' : 'คืนกล่อง';
                    
                    html += `
                    <div class="history-item" style="border-left: 5px solid ${item.type === 'borrow' ? '#4CAF50' : '#FF9800'};">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>${icon} ${text}</strong>
                            <small style="color:#888;">${item.date || 'ไม่ระบุวันที่'}</small>
                        </div>
                        <div style="margin-top:5px; font-size:14px;">
                            หมายเลข: <b>${item.boxId}</b>
                        </div>
                    </div>
                    `;
                });
                container.innerHTML = html;
            }
            
            if(typeof loadUserData === 'function') loadUserData();
        };

// 3. ฟังก์ชันลงทะเบียน (เพิ่มเงื่อนไข Password และ ReturnCount)
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

    // ✅ ตรวจสอบรหัสผ่าน: ต้องมีอักษร+ตัวเลข และไม่เกิน 10 ตัว
    const passRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{1,10}$/;
    if (!passRegex.test(pass)) {
        alert("รหัสผ่านต้องประกอบด้วยตัวอักษรและตัวเลข และมีความยาวไม่เกิน 10 ตัวอักษร");
        return;
    }

    if (pass !== confirmPass) { alert("รหัสผ่านไม่ตรงกัน"); return; }

    try {
        await db.collection("users").doc(phone).set({
            name: name,
            faculty: faculty,
            year: year,
            phone: phone,
            password: pass,
            points: 0,
            returnCount: 0, // ✅ เริ่มต้นจำนวนครั้งที่คืนที่ 0
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem('userPhone', phone);
        localStorage.setItem('userName', name);
        localStorage.setItem('userFaculty', faculty);
        localStorage.setItem('userYear', year);
        localStorage.setItem('userPoints', 0);
        localStorage.setItem('returnCount', 0); // ✅ เก็บจำนวนครั้งลงเครื่อง

        alert("ลงทะเบียนสำเร็จ!");
        window.location.replace('index.html');
    } catch (error) {
        alert("สมัครไม่สำเร็จ: " + error.message);
    }
}

// 4. ฟังก์ชันเข้าสู่ระบบ (โหลดข้อมูล ReturnCount เพิ่ม)
async function performLogin() {
    const phone = document.getElementById('loginPhone').value;
    const pass = document.getElementById('loginPassword').value;

    if (!phone || !pass) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }

    try {
        const userDoc = await db.collection("users").doc(phone).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.password === pass) {
                localStorage.setItem('userPhone', phone);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userFaculty', userData.faculty || '-');
                localStorage.setItem('userYear', userData.year || '-');
                localStorage.setItem('userPoints', userData.points || 0);
                localStorage.setItem('returnCount', userData.returnCount || 0); // ✅ โหลดจำนวนครั้ง
                window.location.replace('index.html');
            } else { alert("รหัสผ่านไม่ถูกต้อง"); }
        } else { alert("ไม่พบเบอร์โทรศัพท์นี้ในระบบ"); }
    } catch (error) { alert("เกิดข้อผิดพลาด: " + error.message); }
}

// 5. แสดงผลข้อมูล (เพิ่มการแสดงผล ReturnCount)
function loadUserData() {
    const name = localStorage.getItem('userName') || 'ผู้ใช้งาน';
    const phone = localStorage.getItem('userPhone') || '...';
    const faculty = localStorage.getItem('userFaculty') || '-';
    const year = localStorage.getItem('userYear') || '-';
    const points = localStorage.getItem('userPoints') || '0';
    const returnCount = localStorage.getItem('returnCount') || '0';

    if (document.getElementById('username')) document.getElementById('username').innerText = name;
    if (document.getElementById('userphone')) document.getElementById('userphone').innerText = phone;
    if (document.getElementById('userfaculty')) document.getElementById('userfaculty').innerText = faculty;
    if (document.getElementById('useryear')) document.getElementById('useryear').innerText = year;
    if (document.getElementById('points')) document.getElementById('points').innerText = points;
    if (document.getElementById('pointsDisplay')) document.getElementById('pointsDisplay').innerText = points;
    
    // ✅ แสดงจำนวนครั้งที่คืนในหน้าจอ (ถ้ามี Element ID นี้)
    if (document.getElementById('returnCountDisplay')) {
        document.getElementById('returnCountDisplay').innerText = returnCount;
    }
}

// 6. ฟังก์ชันคืนกล่อง (ปรับแต้มเป็น +5 และเพิ่มจำนวนครั้ง)
async function returnBoxWithImage() {
    const boxId = document.getElementById('boxInputReturn').value;
    const imageFile = document.getElementById('imageInputReturn').files[0];
    const userPhone = localStorage.getItem('userPhone');

    if (!boxId || !imageFile) { alert("กรุณาระบุข้อมูลให้ครบ"); return; }

    try {
        const storageRef = storage.ref(`returns/${Date.now()}_${boxId}.jpg`);
        await storageRef.put(imageFile);
        const imageUrl = await storageRef.getDownloadURL();

        await db.collection("transactions").add({
            boxId: boxId,
            userPhone: userPhone,
            type: 'return',
            imageUrl: imageUrl,
            date: new Date().toLocaleString('th-TH'),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const userRef = db.collection("users").doc(userPhone);
        await userRef.update({ 
            points: firebase.firestore.FieldValue.increment(5), // ✅ เปลี่ยนเป็น +5 แต้ม
            returnCount: firebase.firestore.FieldValue.increment(1) // ✅ เพิ่มจำนวนครั้ง +1
        });

        // อัปเดตข้อมูลในเครื่อง
        let currentPoints = parseInt(localStorage.getItem('userPoints') || 0);
        let currentReturnCount = parseInt(localStorage.getItem('returnCount') || 0);
        
        localStorage.setItem('userPoints', currentPoints + 5);
        localStorage.setItem('returnCount', currentReturnCount + 1);

        alert("คืนกล่องสำเร็จ! ได้รับ 5 แต้ม");
        window.location.replace('index.html');
    } catch (error) { alert("เกิดข้อผิดพลาด"); }
}

function logout() {
    localStorage.clear();
    window.location.replace('login.html');
}



