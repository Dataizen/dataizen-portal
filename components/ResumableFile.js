'use client';
// Sélection + upload RÉSUMABLE (protocole tus) d'un gros fichier, via Uppy.
// Glisser-déposer, barre de progression, pause/reprise, reprise automatique après
// coupure réseau : pensé pour des utilisateurs non aguerris et des fichiers jusqu'à 10 Go.
// Le fichier ne transite PAS par le portail : il va directement au serveur tusd
// (depot.<domaine>), qui l'enregistre comme ressource CKAN via un ticket signé.
// Le Dashboard est monté impérativement (plugin @uppy/dashboard) pour éviter le barrel
// @uppy/react (qui tire des wrappers non utilisés).
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Tus from '@uppy/tus';
import French from '@uppy/locales/lib/fr_FR';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';

const GO = 1024 * 1024 * 1024;

const ResumableFile = forwardRef(function ResumableFile({ onFileSelected }, ref) {
  const elRef = useRef(null);
  // Callback via ref : le handler appelle toujours la dernière version SANS que l'effet
  // de montage d'Uppy ne dépende de son identité (sinon chaque rendu détruirait Uppy).
  const cbRef = useRef(onFileSelected);
  cbRef.current = onFileSelected;

  const [uppy] = useState(() =>
    new Uppy({
      autoProceed: false,
      locale: French,
      restrictions: { maxNumberOfFiles: 1, maxFileSize: 10 * GO },
    }).use(Tus, {
      endpoint: '',                       // fixé au moment du dépôt (upload())
      chunkSize: 50 * 1024 * 1024,        // morceaux de 50 Mo : reprise fine après coupure
      retryDelays: [0, 1000, 3000, 5000, 10000],
      removeFingerprintOnSuccess: true,
    }));

  // Montage du Dashboard UNE SEULE FOIS (dépendance = uppy, stable). Ne pas ajouter
  // onFileSelected ici : cela recréerait/détruirait Uppy à chaque changement d'état.
  useEffect(() => {
    uppy.use(Dashboard, {
      target: elRef.current, inline: true, height: 260, width: '100%',
      proudlyDisplayPoweredByUppy: false,
      // On MASQUE le bouton d'upload natif d'Uppy : le dépôt est déclenché par le bouton
      // du formulaire (qui fixe l'endpoint tusd + le ticket signé via ref.upload()). Sans
      // ça, cliquer le bouton natif lançait tus avec un endpoint vide -> erreur pour l'usager.
      hideUploadButton: true,
      note: "Glissez votre fichier ici (jusqu'à 10 Go). La reprise est automatique en cas de coupure.",
    });
    const onAdd = (file) => cbRef.current && cbRef.current(file.data, file.name);
    uppy.on('file-added', onAdd);
    return () => {
      uppy.off('file-added', onAdd);
      const d = uppy.getPlugin('Dashboard');
      if (d) uppy.removePlugin(d);
      uppy.destroy();
    };
  }, [uppy]);

  useImperativeHandle(ref, () => ({
    hasFile: () => uppy.getFiles().length > 0,
    fileName: () => (uppy.getFiles()[0] || {}).name || '',
    // Configure l'endpoint + le ticket, puis lance l'upload résumable. Résout à la fin.
    async upload(endpoint, ticket) {
      uppy.getPlugin('Tus').setOptions({ endpoint });
      uppy.getFiles().forEach((f) => uppy.setFileMeta(f.id, { ticket, filename: f.name }));
      const res = await uppy.upload();
      if (res && res.failed && res.failed.length) throw new Error('upload interrompu');
      return res;
    },
  }), [uppy]);

  return <div ref={elRef} />;
});

export default ResumableFile;
