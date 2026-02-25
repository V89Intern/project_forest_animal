<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="show" class="modal-overlay">
                <div class="modal-container">

                    <!-- Header -->
                    <div class="pdpa-header">
                        <h3 class="pdpa-title">ข้อตกลงและเงื่อนไข</h3>
                    </div>

                    <!-- Scrollable Content -->
                    <div class="pdpa-body">
                        <section class="pdpa-section">
                            <h4>1. บทนำ</h4>
                            <p>บริษัท วี89 เทคโนโลยี จำกัด ให้ความสำคัญอย่างยิ่งต่อความเป็นส่วนตัวของลูกค้า
                                ประกาศนี้จัดทำขึ้นเพื่อแจ้งนโยบายการจัดการข้อมูลส่วนบุคคลตามกฎหมาย PDPA</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>2. ติดต่อเรา</h4>
                            <p>ติดต่อเจ้าหน้าที่ DPO ได้ที่กรุงเทพฯ หรืออีเมล <strong>Info@v89tech.com</strong></p>
                        </section>
                        <section class="pdpa-section">
                            <h4>3. วัตถุประสงค์ในการเก็บข้อมูล</h4>
                            <p>เพื่อปฏิบัติตามสัญญา, ปฏิบัติตามกฎหมาย
                                และเพื่อประโยชน์โดยชอบด้วยกฎหมายของบริษัทในการพัฒนาบริการ</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>4. ข้อมูลส่วนบุคคลที่เราจัดเก็บ</h4>
                            <p>ชื่อ-นามสกุล, ข้อมูลติดต่อ, ข้อมูลบัญชีผู้ใช้งาน, ข้อมูลอุปกรณ์ (IP Address/Cookies)
                                และข้อมูลตำแหน่งที่ตั้ง</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>5. แหล่งที่มาของข้อมูล</h4>
                            <p>ได้รับจากคุณโดยตรงเมื่อสมัครสมาชิก หรือเก็บรวบรวมโดยอัตโนมัติผ่านการใช้งานแอปพลิเคชัน</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>6. การแบ่งปันข้อมูล</h4>
                            <p>อาจเปิดเผยแก่บริษัทในกลุ่ม V89, หน่วยงานรัฐบาลตามกฎหมาย
                                หรือผู้ให้บริการสนับสนุนธุรกิจตามความจำเป็น</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>7. การดูแลรักษาและระยะเวลา</h4>
                            <p>เก็บข้อมูลไว้ตลอดระยะเวลาการเป็นสมาชิก และต่อเนื่องไม่เกิน 10 ปี
                                เพื่อวัตถุประสงค์ทางกฎหมายและบัญชี</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>8. การไม่ให้ข้อมูล</h4>
                            <p>หากไม่ให้ข้อมูลที่จำเป็นตามกฎหมายหรือสัญญา เราอาจไม่สามารถให้บริการบางส่วนแก่คุณได้</p>
                        </section>
                        <section class="pdpa-section">
                            <h4>9. สิทธิของเจ้าของข้อมูล</h4>
                            <p>คุณมีสิทธิขอเข้าถึง ขอสำเนา แก้ไข คัดค้านการประมวลผล
                                หรือขอให้ลบข้อมูลได้ตามเงื่อนไขที่กฎหมายกำหนด</p>
                        </section>
                        <p class="pdpa-updated">ปรับปรุงล่าสุดเมื่อวันที่ 11 มกราคม 2566</p>
                    </div>

                    <!-- Footer -->
                    <div class="pdpa-footer">
                        <div class="footer-btns">
                            <button class="btn-accept btn-accept--on" @click="onAccept">ยอมรับและปิด</button>
                        </div>
                    </div>

                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
    show: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'accept'])

function onAccept() {
    emit('accept')
    emit('update:show', false)
}
</script>

<style scoped>
/* ── Overlay ── */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(5px);
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
}

/* ── Container ── */
.modal-container {
    background: #fff;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    animation: popIn 0.3s ease-out;
}

@keyframes popIn {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(12px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* ── Header ── */
.pdpa-header {
    background: #004a8d;
    padding: 16px 24px;
    text-align: center;
    flex-shrink: 0;
}

.pdpa-title {
    color: #fff;
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
}

/* ── Body ── */
.pdpa-body {
    padding: 20px 24px;
    overflow-y: auto;
    flex: 1;
    font-size: 0.86rem;
    color: #4b5563;
    line-height: 1.65;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f1f1;
}

.pdpa-body::-webkit-scrollbar {
    width: 5px;
}

.pdpa-body::-webkit-scrollbar-track {
    background: #f1f1f1;
}

.pdpa-body::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
}

.pdpa-section {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;
}

.pdpa-section:last-of-type {
    border-bottom: none;
}

.pdpa-body h4 {
    color: #004a8d;
    font-weight: 700;
    font-size: 0.92rem;
    margin: 0 0 5px;
}

.pdpa-body p {
    margin: 0;
}

.pdpa-updated {
    font-size: 0.7rem;
    color: #9ca3af;
    font-style: italic;
    text-align: center;
    margin-top: 14px;
}

/* ── Footer ── */
.pdpa-footer {
    padding: 18px 24px;
    border-top: 1px solid #e5e7eb;
    background: #fff;
    flex-shrink: 0;
}

.check-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 16px;
    cursor: pointer;
}

.check-input {
    width: 17px;
    height: 17px;
    margin-top: 2px;
    accent-color: #004a8d;
    cursor: pointer;
    flex-shrink: 0;
}

.check-text {
    font-size: 0.83rem;
    color: #374151;
    line-height: 1.5;
}

.footer-btns {
    display: flex;
    gap: 10px;
}

.btn-reject {
    flex: 1;
    padding: 12px;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    color: #555;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
    min-height: 46px;
}

.btn-reject:hover {
    background: #f3f4f6;
}

.btn-accept {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: #cbd5e1;
    color: #fff;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: not-allowed;
    transition: all 0.2s;
    min-height: 46px;
}

.btn-accept--on {
    background: #004a8d;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 74, 141, 0.25);
}

.btn-accept--on:hover {
    background: #003a6e;
}

.btn-accept--on:active {
    transform: scale(0.97);
}

/* ── Transition ── */
.modal-enter-active {
    transition: opacity 0.25s ease;
}

.modal-leave-active {
    transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

/* ── Mobile ── */
@media (max-width: 600px) {
    .modal-overlay {
        padding: 0;
        align-items: flex-end;
    }

    .modal-container {
        max-width: 100%;
        border-radius: 20px 20px 0 0;
        max-height: 92vh;
    }

    .pdpa-body {
        max-height: 44vh;
        padding: 14px 16px;
        font-size: 0.82rem;
    }

    .pdpa-header {
        padding: 13px 18px;
    }

    .pdpa-footer {
        padding: 14px 16px;
    }

    .btn-reject,
    .btn-accept {
        min-height: 50px;
        font-size: 0.9rem;
    }
}
</style>
