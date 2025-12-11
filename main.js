const testimonialTrack = document.querySelector(".testimonial-track");
const testimonialSlides = document.querySelectorAll(".testimonial-slide");
const prevButton = document.querySelector(".t-btn.prev");
const nextButton = document.querySelector(".t-btn.next");
const dots = document.querySelectorAll(".t-dot");

let currentIndex = 0;

const updateTestimonials = () => {
  testimonialTrack.style.transform = `translateX(-${currentIndex * 100}%)`;

  testimonialSlides.forEach((slide, index) => {
    slide.classList.toggle("active", index === currentIndex);
  });

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentIndex);
  });
};

const goToNext = () => {
  currentIndex = (currentIndex + 1) % testimonialSlides.length;
  updateTestimonials();
};

const goToPrev = () => {
  currentIndex = (currentIndex - 1 + testimonialSlides.length) % testimonialSlides.length;
  updateTestimonials();
};

nextButton?.addEventListener("click", goToNext);
prevButton?.addEventListener("click", goToPrev);

dots.forEach((dot, index) => {
  dot.addEventListener("click", () => {
    currentIndex = index;
    updateTestimonials();
  });
});

updateTestimonials();
