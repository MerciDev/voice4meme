import type { Scene } from './types';

export const defaultScenes: Scene[] = [
  {
    id: 'scene-1',
    title: 'Encuentro Tenso (2 Pjs)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    characters: [
      { id: 'c1', name: 'Thom', color: '#8b5cf6' },
      { id: 'c2', name: 'Celia', color: '#ec4899' }
    ],
    dialogues: [
      { id: 'd1', characterId: 'c1', startTime: 12, endTime: 15, text: "You're a jerk, Thom." },
      { id: 'd2', characterId: 'c2', startTime: 16, endTime: 18, text: "Look, I'm sorry." },
      { id: 'd3', characterId: 'c1', startTime: 19, endTime: 22, text: "My arm... it's completely destroyed." },
      { id: 'd4', characterId: 'c2', startTime: 23, endTime: 26, text: "It's just a scratch. We'll fix it." }
    ]
  },
  {
    id: 'scene-2',
    title: 'La Búsqueda (2 Pjs)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    characters: [
      { id: 'c3', name: 'Sintel', color: '#10b981' },
      { id: 'c4', name: 'Chamán', color: '#f59e0b' }
    ],
    dialogues: [
      { id: 'd5', characterId: 'c4', startTime: 40, endTime: 44, text: "¿Qué buscas en estas tierras tan lejanas?" },
      { id: 'd6', characterId: 'c3', startTime: 45, endTime: 48, text: "Busco a mi dragón. Me lo arrebataron." },
      { id: 'd7', characterId: 'c4', startTime: 50, endTime: 53, text: "El camino será peligroso..." }
    ]
  },
  {
    id: 'scene-3',
    title: 'Monólogo de Venganza (1 Pj)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    characters: [
      { id: 'c5', name: 'Emo', color: '#ef4444' }
    ],
    dialogues: [
      { id: 'd8', characterId: 'c5', startTime: 10, endTime: 18, text: "He estado esperando este momento durante años. Ahora verán." }
    ]
  },
  {
    id: 'scene-4',
    title: 'Discusión en Grupo (3 Pjs)',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    characters: [
      { id: 'c6', name: 'Rinky', color: '#3b82f6' },
      { id: 'c7', name: 'Gimera', color: '#14b8a6' },
      { id: 'c8', name: 'Frank', color: '#a855f7' }
    ],
    dialogues: [
      { id: 'd9', characterId: 'c6', startTime: 5, endTime: 8, text: "¡Tenemos que movernos ya!" },
      { id: 'd10', characterId: 'c7', startTime: 9, endTime: 12, text: "¿Y a dónde sugieres que vayamos?" },
      { id: 'd11', characterId: 'c8', startTime: 13, endTime: 16, text: "Tranquilos, tengo un plan." },
      { id: 'd12', characterId: 'c6', startTime: 17, endTime: 20, text: "¡Más te vale que funcione!" }
    ]
  }
];
