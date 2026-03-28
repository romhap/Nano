// ============================================================
// CONFIGURATION — Replace these with your actual Stripe links
// ============================================================
// 1. Create a Stripe account → stripe.com
// 2. Add your IBAN (EE257777000143102704, BIC: LHVBEE22) as payout method
// 3. Create a Product: "IMAT Mentorship" at €44/month recurring
// 4. Create a Payment Link for that product
//    - Set success URL to: https://YOUR-DOMAIN.com/?payment=success
//    - Enable "collect email address"
// 5. Paste the payment link URL below:
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/YOUR_LINK_HERE';
// 6. Enable the Stripe Customer Portal and paste link below (for cancellations):
const STRIPE_PORTAL_LINK = 'https://billing.stripe.com/p/login/YOUR_PORTAL_HERE';
// ============================================================

// === Countdown Timer (7 days from now, resets weekly) ===
function updateCountdown() {
    const now = new Date();
    // Calculate next Sunday midnight as deadline
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const target = new Date(now);
    target.setDate(now.getDate() + daysUntilSunday);
    target.setHours(23, 59, 59, 0);

    const diff = target - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const el = document.getElementById('countdown');
    if (el) {
        el.textContent = `${days}d ${hours}h ${mins}m`;
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

    // Store locally so we can show success page on return
    localStorage.setItem('imat_subscriber', JSON.stringify(data));

    // Build Stripe link with prefilled email
    const paymentUrl = STRIPE_PAYMENT_LINK +
        (STRIPE_PAYMENT_LINK.includes('?') ? '&' : '?') +
        'prefilled_email=' + encodeURIComponent(data.email);

    // Redirect to Stripe Checkout
    window.location.href = paymentUrl;
});

// === Check for successful payment return ===
if (window.location.search.includes('payment=success')) {
    // Show success step
    const step1 = document.getElementById('step1');
    const stepSuccess = document.getElementById('stepSuccess');
    if (step1) step1.classList.remove('active');
    if (stepSuccess) stepSuccess.classList.add('active');

    // Set portal link
    const manageLink = document.getElementById('manageLink');
    if (manageLink) manageLink.href = STRIPE_PORTAL_LINK;

    // Scroll to enroll section
    setTimeout(() => {
        document.getElementById('enroll').scrollIntoView({ behavior: 'smooth' });
    }, 300);

    // Clean URL
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
