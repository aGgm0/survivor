// Les 2 morceaux de Node utilisés par la simulation (variables d'environnement, sortie du
// terminal). Déclarés à la main : le projet n'installe pas @types/node (voir CLAUDE.md § 11).
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: { write(text: string): boolean };
};
