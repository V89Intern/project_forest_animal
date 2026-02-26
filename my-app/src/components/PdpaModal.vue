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

<style scoped src="./PdpaModal.css"></style>
