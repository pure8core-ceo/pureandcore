// 폼 제출 처리 (Supabase 사용)
async function submitToSupabase(formData) {
  try {
    // Supabase API 사용
    if (window.consultationAPI) {
      const result = await window.consultationAPI.save(formData);
      return result;
    } else {
      console.error('Supabase client not initialized');
      return { success: false, error: 'Database connection error' };
    }
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
}

// 폼 초기화
document.addEventListener('DOMContentLoaded', function() {
  const contactForm = document.getElementById('consultForm');

  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '전송 중...';
      submitBtn.disabled = true;

      const formData = {
        name: this.name.value,
        phone: this.phone.value,
        address: this.address.value,
        type: this.type?.value,
        size: this.size.value,
        date: this.date?.value,
        message: this.message?.value
      };

      const result = await submitToSupabase(formData);

      if (result.success) {
        alert('신청이 완료되었습니다. 곧 연락드리겠습니다!');
        this.reset();
      } else {
        alert('신청 중 오류가 발생했습니다. 다시 시도해주세요.');
      }

      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    });
  }
});