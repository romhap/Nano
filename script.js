// ============================================================
// CONFIGURATION
// ============================================================
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/eVqdR9gqCcfCduw0lXgw001';
const STRIPE_PORTAL_LINK = 'https://billing.stripe.com/p/login/28E3cvb6i4NaaikecNgw000';
// ============================================================

// === Countdown Timer (7 days from first visit, stored in localStorage) ===
function updateCountdown() {
    const DURATION_MS = 7 * 24 * 60 * 60 * 1000;
    let deadline = localStorage.getItem('imat_deadline');
    if (!deadline) {
        deadline = Date.now() + DURATION_MS;
        localStorage.setItem('imat_deadline', deadline);
    }
    deadline = Number(deadline);

    const diff = Math.max(0, deadline - Date.now());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const el = document.getElementById('countdown');
    if (el) {
        el.textContent = `${days}D ${hours}H ${mins}M`;
    }
}

updateCountdown();
setInterval(updateCountdown, 60000);

// === Terms toggle ===
document.getElementById('toggleTerms').addEventListener('click', function () {
    const box = document.getElementById('termsBox');
    box.classList.toggle('open');
    this.textContent = box.classList.contains('open')
        ? 'Hide Terms & Conditions ↑'
        : 'Read Terms & Conditions ↓';
});

// === Checkbox enables button ===
document.getElementById('acceptTerms').addEventListener('change', function () {
    document.getElementById('payBtn').disabled = !this.checked;
});

// === Form submission → redirect to Stripe ===
document.getElementById('enrollForm').addEventListener('submit', function (e) {
    e.preventDefault();

    if (!document.getElementById('acceptTerms').checked) return;

    const data = {
        name: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        country: document.getElementById('country').value.trim(),
        motivation: document.getElementById('motivation').value.trim(),
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('imat_subscriber', JSON.stringify(data));

    const paymentUrl = STRIPE_PAYMENT_LINK +
        (STRIPE_PAYMENT_LINK.includes('?') ? '&' : '?') +
        'prefilled_email=' + encodeURIComponent(data.email);

    window.location.href = paymentUrl;
});

// === Check for successful payment return ===
if (window.location.search.includes('payment=success')) {
    const step1 = document.getElementById('step1');
    const stepSuccess = document.getElementById('stepSuccess');
    if (step1) step1.classList.remove('active');
    if (stepSuccess) stepSuccess.classList.add('active');

    const manageLink = document.getElementById('manageLink');
    if (manageLink) manageLink.href = STRIPE_PORTAL_LINK;

    setTimeout(() => {
        document.getElementById('enroll').scrollIntoView({ behavior: 'smooth' });
    }, 300);

    window.history.replaceState({}, '', window.location.pathname);
}

// === Smooth scroll ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// === Scroll animations ===
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.stat, .compare-card, .include-item, .cred, .about-letter').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});
