export const templates: Record<string, string> = {
  "Orden procesal": "# ORDEN PROCESAL\n\n**Número de caso:** {{case_number}}  \n**División:** {{division}}  \n**Funcionario:** {{ponente}}\n\n## Antecedentes\n[Describa los antecedentes relevantes]\n\n## Consideraciones\n[Desarrolle las razones de la decisión]\n\n## Resuelve\n**PRIMERO.** [Decisión]\n\n**SEGUNDO.** [Decisión complementaria]",
  "Resolución": "# RESOLUCIÓN\n\n## Antecedentes\n[Antecedentes]\n\n## Consideraciones\n[Consideraciones]\n\n## Resuelve\n[Decisión]",
  "Acta de audiencia": "# ACTA DE AUDIENCIA\n\n**Fecha y hora:** {{fecha}}  \n**Número de caso:** {{case_number}}  \n**Sala:** {{despacho}}\n\n## Participantes\n- [Nombre y rol]\n\n## Desarrollo\n[Registro de la sesión]\n\n## Decisiones\n[Decisiones]",
};
