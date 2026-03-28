// === Multi-step Enrollment Flow ===
const steps = {
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3'),
    step4: document.getElementById('step4')
};

let subscriberData = {};

function showStep(stepId) {
    Object.values(steps).forEach(s => s.classList.remove('active'));
    steps[stepId].classList.add('active');
    steps[stepId].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Step 1: Details Form
document.getElementById('detailsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    subscriberData = {
        name: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        country: document.getElementById('country').value.trim(),
        motivation: document.getElementById('motivation').value.trim()
    };
    showStep('step2');
});

// Step 2: Terms
document.getElementById('acceptTerms').addEventListener('change', function() {
    document.getElementById('toPayment').disabled = !this.checked;
});

document.getElementById('toPayment').addEventListener('click', function() {
    if (document.getElementById('acceptTerms').checked) {
        // Update payment reference with subscriber name
        document.getElementById('paymentRef').textContent = 'IMAT-' + subscriberData.name.replace(/\s+/g, '');
        showStep('step3');
    }
});

document.getElementById('backToDetails').addEventListener('click', function() {
    showStep('step1');
});

// Step 3: Payment
document.getElementById('confirmPayment').addEventListener('change', function() {
    document.getElementById('confirmBtn').disabled = !this.checked;
});

document.getElementById('confirmBtn').addEventListener('click', function() {
    if (document.getElementById('confirmPayment').checked) {
        showStep('step4');
    }
});

document.getElementById('backToTerms').addEventListener('click', function() {
    showStep('step2');
});

// Copy IBAN
function copyIBAN() {
    const iban = document.getElementById('ibanNumber').textContent;
    navigator.clipboard.writeText(iban).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
}

// === Smooth scroll for anchor links ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// === Intersection Observer for fade-in animations ===
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for scroll animation
document.querySelectorAll('.truth-card, .compare-card, .benefit-card, .cred-item, .exclusive-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});
