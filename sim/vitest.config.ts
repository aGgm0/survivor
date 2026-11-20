// Config Vitest à part pour la simulation : `npm run sim` ne lance que sim/, et `npm run test`
// n'attend pas les parties du bot. Reprend la config du jeu (define de la version...) en
// remplaçant seulement la liste des fichiers (mergeConfig l'aurait additionnée).
import base from '../vite.config';

export default { ...base, test: { include: ['sim/**/*.test.ts'] } };
