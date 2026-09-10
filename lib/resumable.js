'use client';
// Upload RÉSUMABLE (tus) programmatique, sans interface Uppy : pour les gros fichiers
// remplacés/ajoutés depuis la fiche d'un jeu (bouton « Mettre à jour les données »).
// Reprise automatique après coupure (retryDelays) ; progression via onProgress(pct).
// Uppy est importé dynamiquement (client-only) pour ne pas peser sur le SSR.

export async function uploadResumable(file, endpoint, ticket, onProgress) {
  const { default: Uppy } = await import('@uppy/core');
  const { default: Tus } = await import('@uppy/tus');
  const uppy = new Uppy({
    autoProceed: false,
    restrictions: { maxNumberOfFiles: 1, maxFileSize: 10 * 1024 * 1024 * 1024 },
  }).use(Tus, {
    endpoint,
    chunkSize: 50 * 1024 * 1024,
    retryDelays: [0, 1000, 3000, 5000, 10000],
    removeFingerprintOnSuccess: true,
  });
  try {
    const id = uppy.addFile({ name: file.name, type: file.type, data: file });
    uppy.setFileMeta(id, { ticket, filename: file.name });
    if (onProgress) {
      uppy.on('upload-progress', (f, p) => {
        if (p && p.bytesTotal) onProgress(Math.round((100 * p.bytesUploaded) / p.bytesTotal));
      });
    }
    const res = await uppy.upload();
    if (res && res.failed && res.failed.length) throw new Error('upload interrompu');
  } finally {
    uppy.destroy();
  }
}
