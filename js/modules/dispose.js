/**
 * Deep dispose for Object3D trees (geometries, materials, textures).
 * Skips geometries listed in sharedGeometry Set (e.g. scene pool).
 */

export function disposeObject3D(object, sharedGeometries = null) {
    if (!object) return;

    object.traverse((node) => {
        if (node.geometry) {
            const geo = node.geometry;
            if (!sharedGeometries || !sharedGeometries.has(geo)) {
                geo.dispose();
            }
        }

        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
            if (!material) return;
            for (const key of Object.keys(material)) {
                const value = material[key];
                if (value && typeof value === 'object' && value.isTexture) {
                    value.dispose();
                }
            }
            material.dispose();
        });
    });
}
