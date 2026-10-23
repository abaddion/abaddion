/**
 * Fixed floor rail — real links with aria-current (enhances static HTML when present).
 */

export class FloorRail {
    constructor(container, floors, onNavigate) {
        this.container = container;
        this.onNavigate = onNavigate;
        this.links = [];

        let ul = container.querySelector('.floor-rail-list');
        if (!ul) {
            ul = document.createElement('ul');
            ul.className = 'floor-rail-list';
            container.appendChild(ul);
        }

        const existing = ul.querySelectorAll('a[href]');
        if (existing.length >= floors.length) {
            existing.forEach((a, index) => {
                if (index >= floors.length) return;
                const floor = floors[index];
                a.href = floor.route;
                a.textContent = floor.title;
                a.dataset.floorIndex = String(index);
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.onNavigate(floor.route, index);
                });
                this.links.push(a);
            });
            return;
        }

        ul.replaceChildren();
        floors.forEach((floor, index) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = floor.route;
            a.textContent = floor.title;
            a.dataset.floorIndex = String(index);
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.onNavigate(floor.route, index);
            });
            li.appendChild(a);
            ul.appendChild(li);
            this.links.push(a);
        });
    }

    setActive(index) {
        this.links.forEach((a, i) => {
            if (i === index) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
        const active = this.links[index];
        if (active && window.innerWidth < 768) {
            active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }
    }
}
