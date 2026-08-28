// ============================================================
// CONFIGURATION
// ============================================================
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/7sY7sLdeqdjGaik1q1gw002';
// Paste the SAME Google Apps Script Web App URL you put in lounge.html (ends in /exec).
const SIGNUP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwszZzQywosaVON0oalp_CzcfYwMjWI5hP6Kuj4gBsMmfBHj-y4Z85uz7EzIqnFDuFeIw/exec';
// ============================================================

// Fire-and-forget: send an applicant to the Google Sheet. Never blocks the
// redirect to Stripe; keepalive lets it finish even as the page navigates away.
function reportSignup(payload) {
    if (!SIGNUP_ENDPOINT) return;
    try {
        new Image().src = SIGNUP_ENDPOINT + '?data=' + encodeURIComponent(JSON.stringify(payload));
    } catch (e) {}
}

// Vercel Web Analytics custom event -- see the <head> script tags for setup.
// Requires a Vercel Pro/Enterprise plan for custom events to show up; safe
// no-op otherwise (va() just queues quietly if the plan doesn't support it).
function track(name, data) {
    try { window.va && window.va('event', { name: name, data: data || {} }); } catch (e) {}
}

// === Terms toggle ===
document.getElementById('toggleTerms').addEventListener('click', function () {
    const box = document.getElementById('termsBox');
    box.classList.toggle('open');
    this.textContent = box.classList.contains('open')
        ? 'Hide Terms & Conditions ↑'
        : 'Read Terms & Conditions ↓';
    if (box.classList.contains('open')) track('terms_opened');
});

// === Both checkboxes must be checked to enable button ===
const acceptTerms = document.getElementById('acceptTerms');
const acceptEligibility = document.getElementById('acceptEligibility');

function updatePayBtn() {
    document.getElementById('payBtn').disabled = !(acceptTerms.checked && acceptEligibility.checked);
}

acceptTerms.addEventListener('change', updatePayBtn);
acceptEligibility.addEventListener('change', updatePayBtn);

// === Form submission → redirect to Stripe ===
document.getElementById('enrollForm').addEventListener('submit', function (e) {
    e.preventDefault();

    if (!acceptTerms.checked || !acceptEligibility.checked) return;

    const TERMS_VERSION = '2026.03.31';
    const timestamp = new Date().toISOString();

    const data = {
        name: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        consents: {
            terms_accepted: true,
            eligibility_confirmed: true,
            terms_version: TERMS_VERSION
        },
        timestamp: timestamp,
        user_agent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language
    };

    // Attempt to log IP via public API (best-effort, non-blocking)
    fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(ip => { data.ip = ip.ip; })
        .catch(() => { data.ip = 'unavailable'; })
        .finally(() => {
            // Store submission log (append to array for multiple submissions)
            const log = JSON.parse(localStorage.getItem('imat_submissions') || '[]');
            log.push(data);
            localStorage.setItem('imat_submissions', JSON.stringify(log));
            localStorage.setItem('imat_subscriber', JSON.stringify(data));

            // Send the applicant to the Google Sheet before redirecting to Stripe
            reportSignup({
                source: 'application',
                email: data.email,
                name: data.name,
                whatsapp: data.whatsapp,
                user_agent: data.user_agent
            });
            track('enroll_submit');

            const paymentUrl = STRIPE_PAYMENT_LINK +
                (STRIPE_PAYMENT_LINK.includes('?') ? '&' : '?') +
                'prefilled_email=' + encodeURIComponent(data.email);

            window.location.href = paymentUrl;
        });
});

// === Check for successful payment return ===
if (window.location.search.includes('payment=success')) {
    const step1 = document.getElementById('step1');
    const stepSuccess = document.getElementById('stepSuccess');
    if (step1) step1.classList.remove('active');
    if (stepSuccess) stepSuccess.classList.add('active');

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

// === Cancel-flow tracking ===
const cancelPortalLink = document.getElementById('cancelPortalLink');
if (cancelPortalLink) cancelPortalLink.addEventListener('click', () => track('cancel_portal_click'));

