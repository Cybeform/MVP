// src/components/MainArea.jsx

import React, { useState, useEffect, useRef } from 'react'
import MicButton from './MicButton'
import {
  startRecording,
  stopRecording,
  fetchRecordings,
} from '../api'


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'

export default function MainArea({ onNewRecording }) {
  const [isRecording,    setIsRecording]    = useState(false)
  const [currentId,      setCurrentId]      = useState(null)
  const [isUploading,    setIsUploading]    = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isGenerating,   setIsGenerating]   = useState(false)
  const [genProgress,    setGenProgress]    = useState(0)
  const [genStep,        setGenStep]        = useState('')
  const evtRef = useRef(null)

  // -----------------------------
  // 1) Enregistrement live
  // -----------------------------
  const handleMic = async () => {
    if (!isRecording) {
      try {
        const id = await startRecording()
        console.log("🆔 Returned from startRecording():", id)
        setCurrentId(id)
        setIsRecording(true)
      } catch (err) {
        console.error(err)
        alert('Impossible de démarrer l’enregistrement')
      }
    } else {
      try {
        await stopRecording(currentId)
        setIsRecording(false)
        const recs = await fetchRecordings()
        onNewRecording(recs)
      } catch (err) {
        console.error(err)
        alert('Impossible d’arrêter l’enregistrement')
      }
    }
  }

  // -----------------------------
  // 2) Upload de fichier audio
  // -----------------------------
  const BACKEND_URL = 'http://localhost:8000';

const handleUpload = e => {
  const file = e.target.files[0];
  if (!file) return;
  setIsUploading(true);
  setUploadProgress(0);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${BACKEND_URL}/upload`);
  xhr.upload.onprogress = ev => {
    if (ev.lengthComputable) {
      setUploadProgress(Math.round(ev.loaded * 100 / ev.total));
    }
  };
  xhr.onload = async () => {
    setIsUploading(false);
    setUploadProgress(0);
    if (xhr.status === 200) {
      const { id } = JSON.parse(xhr.responseText);
      setCurrentId(id);
      const recs = await fetchRecordings();
      onNewRecording(recs);
    } else {
      alert(`Erreur upload (${xhr.status}) : ${xhr.responseText}`);
    }
  };
  xhr.onerror = () => {
    setIsUploading(false);
    alert('Erreur réseau durant l’upload');
  };

  const form = new FormData();
  form.append('file', file);   // <— ici on appelle bien "file"
  xhr.send(form);
};


  // -----------------------------
  // 3) Génération du rapport SSE
  // -----------------------------
  const handleGenerate = () => {
    if (!currentId) return

    // Reset state
    if (evtRef.current) {
      evtRef.current.close()
      evtRef.current = null
    }
    setIsGenerating(true)
    setGenProgress(0)
    setGenStep('Diarization')

    // Use absolute URL to avoid proxy issues
    const url = `${BACKEND_URL}/generate-report-stream/${currentId}`
    const evt = new EventSource(url)
    evtRef.current = evt

    evt.onmessage = e => {
      const msg = JSON.parse(e.data)

      // 1) phase = "error" → show the real backend message
      if (msg.phase === 'error') {
        evt.close()
        alert(`Erreur durant la génération : ${msg.message}`)
        setIsGenerating(false)
        return
      }

      // 2) Normal phases
      switch (msg.phase) {
        case 'diarization':
          // Skip immediately
          if (msg.status === 'skipped' || msg.status === 'end') {
            setGenStep('Transcription')
            setGenProgress(0)
          }
          break

        case 'transcription':
          setGenStep('Transcription')
          if (msg.total) {
            setGenProgress(Math.round(msg.done * 100 / msg.total))
          }
          break

        case 'summary':
          if (msg.status === 'start') {
            setGenStep('Résumé')
            setGenProgress(0)
          }
          break

        case 'docx':
          if (msg.status === 'start') {
            setGenStep('Génération du rapport')
            setGenProgress(0)
          }
          break

        case 'done':
          evt.close()
          // download endpoint
          const link = document.createElement('a')
          link.href = `${BACKEND_URL}/download-report/${currentId}`
          link.click()
          setIsGenerating(false)
          break

        default:
          break
      }
    }

    // Never show the generic “Erreur durant la génération…” here,
    // because real errors come via phase:"error"
    evt.onerror = () => {
      // just close silently
      if (evtRef.current) {
        evtRef.current.close()
        evtRef.current = null
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full px-4 py-8">
      <div className="bg-blue-900 rounded-2xl p-6 flex flex-col items-center w-full max-w-md space-y-6">

        {/* 1) Mic Button */}
        <MicButton
          isRecording={isRecording}
          onClick={handleMic}
        />

        {/* 2) File upload */}
        <input
          id="file-upload"
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleUpload}
        />
        <label
          htmlFor="file-upload"
          className={`
            inline-flex items-center justify-center
            bg-blue-600 hover:bg-blue-700
            text-white font-semibold
            rounded-full px-6 py-3
            cursor-pointer transition
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          {isUploading
            ? `Téléversement ${uploadProgress}%`
            : 'Importer un fichier audio'}
        </label>

        {/* 3) Generate report */}
        {!isRecording && currentId && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`
              inline-flex items-center justify-center
              bg-green-500 hover:bg-green-600
              text-white font-semibold
              rounded-full px-6 py-3
              cursor-pointer transition
              ${isGenerating ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {isGenerating
              ? `${genStep} ${genProgress > 0 ? `${genProgress}%` : ''}`
              : 'Générer le Rapport (.docx)'}
          </button>
        )}

        {/* 4) Progress bar */}
        {isGenerating && (
          <div className="w-full">
            <p className="text-white text-sm mb-1">{genStep}</p>
            <div className="w-full h-2 bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 transition-all"
                style={{ width: `${genProgress}%` }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
