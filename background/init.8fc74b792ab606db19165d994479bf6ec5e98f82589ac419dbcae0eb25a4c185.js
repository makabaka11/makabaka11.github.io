(() => {
    const configURL = document.currentScript.dataset.config;
    const container = document.getElementById('particles-js');
    if (!container || container.dataset.initialized) return;
    container.dataset.initialized = 'true';

    fetch(configURL).then(response => {
        if (!response.ok) throw new Error(`Particle config: ${response.status}`);
        return response.json();
    }).then(config => {
        const mobile = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        // Handle actual canvas size changes ourselves, not address-bar resize events.
        config.interactivity.events.resize = false;
        if (mobile) {
            config.particles.number.value = 32;
            config.particles.number.density.enable = false;
            config.retina_detect = false;
            config.interactivity.events.onhover.enable = false;
            config.interactivity.events.onclick.enable = false;
        }
        config.particles.move.enable = !reducedMotion.matches;
        window.particlesJS('particles-js', config);
        const instance = window.pJSDom.find(item => item.pJS.canvas.el.parentNode === container).pJS;
        let width = container.clientWidth;
        let height = container.clientHeight;

        function updateMotion() {
            window.cancelAnimationFrame(instance.fn.drawAnimFrame);
            instance.particles.move.enable = !document.hidden && !reducedMotion.matches;
            if (!document.hidden) instance.fn.vendors.draw();
        }
        document.addEventListener('visibilitychange', updateMotion);
        reducedMotion.addEventListener('change', updateMotion);
        updateMotion();

        // Keep existing particles on resize; refreshing would randomize the whole background.
        function resize() {
            const nextWidth = container.clientWidth;
            const nextHeight = container.clientHeight;
            if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight)) return;
            instance.particles.array.forEach(particle => {
                particle.x *= nextWidth / width;
                particle.y *= nextHeight / height;
            });
            width = nextWidth;
            height = nextHeight;
            instance.canvas.w = width * instance.canvas.pxratio;
            instance.canvas.h = height * instance.canvas.pxratio;
            instance.fn.canvasSize();
            instance.fn.vendors.densityAutoParticles();
            if (!instance.particles.move.enable) instance.fn.particlesDraw();
        }
        if ('ResizeObserver' in window) {
            new ResizeObserver(resize).observe(container);
        } else {
            window.addEventListener('resize', resize, { passive: true });
        }
    }).catch(error => console.warn('Particle background unavailable', error));
})();
