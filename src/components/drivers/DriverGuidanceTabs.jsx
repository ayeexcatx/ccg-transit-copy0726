import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DriverGuidanceTabs({ helpLanguage, onLanguageChange }) {
  return (
    <Card className="border-slate-200 bg-slate-50/60">
      <CardContent className="p-5 space-y-6">
        <div className="bg-amber-50 text-amber-900 p-3 text-sm rounded-lg border border-amber-200">
          Driver SMS reminder: owners can enable the company permission layer here, but each driver still must use <span className="font-medium">Menu → Profile</span> to opt in before SMS becomes active.
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {[
          { value: 'en', label: 'English' },
          { value: 'pt', label: 'Portuguese' }].
          map((language) =>
          <Button
            key={language.value}
            type="button"
            variant={helpLanguage === language.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onLanguageChange(language.value)}
            className={helpLanguage === language.value ? 'shadow-sm' : 'bg-white'}>
            
              {language.label}
            </Button>
          )}
        </div>

        {helpLanguage === 'en' ?
        <>
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Driver Portal</h3>
              <p className="text-sm leading-6 text-slate-700">
                A driver portal <span className="font-medium">ONLY</span> has the ability to view driver-specific announcements, dispatches that they are
                assigned to (normal dispatch details only; no editing), driver profile, protocols, and have the ability to report incidents. <span className="font-medium">They do not</span> have the ability to view or see
                ANYTHING else, including the confirmation logs, other drivers, or even other trucks/drivers assigned to the same dispatch.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Assigning Drivers</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  A driver can only see a dispatch and receive notifications <span className="font-medium">IF</span> and <span className="font-medium">WHEN</span> you assign them to a
                  truck number on a specific dispatch and click "SEND".
                </li>
                <li>
                  When you <span className="font-medium">select a driver</span> on a dispatch and click "SEND", a copy of the dispatch and a notification will be sent to the
                  driver. <span className="font-medium text-emerald-600">“Dispatch Assigned: You have been assigned to a dispatch”</span><br />
                  IT WILL NOT SEND IF YOU DO NOT CLICK "SEND" !!
                </li>
                <li>
                  Any changes made <span className="font-medium">by the dispatcher</span> (CCG) after a driver is assigned will also be received by the driver as long
                  as they remain assigned. (<span className="text-amber-600">Amendments</span>, <span className="text-red-600">Cancellations</span>)
                </li>
                <li>
                  If you <span className="font-medium">"CANCEL" a driver</span> from the dispatch assignment, they will immediately receive a
                  <span className="font-medium text-red-600"> No Longer Available</span> notification.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Changing Drivers / Trucks</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  If you have a driver assigned and you <span className="font-medium">switch the driver</span> in the dropdown menu, the driver you removed will immediately receive a
                  <span className="text-red-600"> No Longer Available</span> notification, and the driver you added will immediately receive a <span className="text-emerald-600">new "Dispatch Assigned"</span> notification when you click "SEND".
                </li>
              </ul>
              <p className="pl-5 text-sm text-slate-500 italic leading-6">
                Example: Switch Driver 1 to Driver 2 and click "SEND"<br />
                Driver 1 = "Dispatch Removed: This dispatch assignment is no longer available" notification<br />
                Driver 2 = "Dispatch Assigned: You have been assigned to a dispatch" notification
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  If you <span className="font-medium">switch a truck</span> that currently has a driver assigned, the driver assignment will <span className="font-medium">RESET</span> and the driver will receive a <span className="text-red-600">No Longer Available</span> notification.
                  They will no longer be able to view the dispatch.
                </li>
              </ul>
              <p className="pl-5 text-sm text-slate-500 italic leading-6">
                Example: Truck 1 (which has Driver 1 assigned) is switched to Truck 2 which is not dispatched:<br />
                The driver assignment is RESET (driver removed), so Driver 1 will receive a "No Longer Available" notification. Reassign them to Truck 2 to send them a new dispatch assignment notification, or choose a new driver to send the new dispatch assignment to them.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  If you <span className="font-medium">swap trucks</span> that currently have drivers assigned, the driver assignments will <span className="font-medium">RESET</span> and the drivers will both receive a <span className="text-red-600">No Longer Available</span> notification.
                  They will no longer be able to view the dispatches until you reassign them. When you reassign them, they will receive a new dispatch assignment notification.
                </li>
              </ul>
              <p className="pl-5 text-sm text-slate-500 italic leading-6">
                Example: Truck 1 has Driver 1 assigned AND is switched to Truck 2 that has Driver 2 assigned:<br />
                Both trucks will have their drivers RESET (drivers removed), so both drivers will receive a "No Longer Available" notification. Reassign them and click "SEND" to send the new dispatch assignment.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Please make sure to double-check all the selections and changes you make, and that you <span className="font-medium">reassign and "SEND"</span> the drivers to the correct dispatch if you <span className="font-medium">switch trucks</span>.
                </li>
                <li>
                  It is still your responsibility to follow up with your drivers to get verbal or written confirmation that they have the correct dispatch and that they understand the assignment.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Passive Driver Notifications</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  If you <span className="font-medium">select a driver, click "SEND" and do nothing else</span>, they will receive notifications and dispatch updates the same way you receive them, except they will only receive the ones pertaining to the dispatch they are <span className="font-medium">assigned</span> to.
                </li>
                <li>
                  What you see on your screen is exactly how things stand. If you have a driver selected to a dispatch (& "SENT"), your driver can also see that dispatch. <br />
                  If you have <span className="font-medium">'No Driver Selected'</span> on your dispatch, then your driver cannot see that dispatch.
                </li>
              </ul>
            </section>
          </> :

        <>
            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Portal do Motorista</h3>
              <p className="text-sm leading-6 text-slate-700">
                O portal do motorista permite <span className="font-medium">APENAS</span> visualizar anúncios específicos para motoristas, os despachos aos quais está atribuído
                (apenas os detalhes normais do despacho) e reportar incidentes. <span className="font-medium">Não tem acesso</span> a MAIS NADA, incluindo registos de confirmação,
                outros motoristas ou até outros camiões atribuídos ao mesmo despacho.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Atribuição de Motoristas</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Um motorista só consegue ver um despacho e receber notificações <span className="font-medium">SE</span> e <span className="font-medium">QUANDO</span> for atribuído a um número de camião num despacho e clique "SEND".
                </li>
                <li>
                  Ao <span className="font-medium">selecionar um motorista</span> num despacho e clique "SEND", será enviada uma cópia do despacho e uma notificação ao motorista: <span className="font-medium text-emerald-600">“Você foi designado para um despacho”</span>
                </li>
                <li>
                  Quaisquer alterações feitas pelo <span className="font-medium">despachante</span> (CCG) após a atribuição também serão recebidas pelo motorista, desde que ele continue atribuído.
                  (<span className="text-amber-600">alterações</span>, <span className="text-red-600">cancelamentos</span>)
                </li>
                <li>
                  Se <span className="font-medium">"CANCEL" um motorista</span> da atribuição do despacho, ele receberá imediatamente uma notificação de <span className="font-medium text-red-600">"A atribuição do despacho não está mais disponível"</span>.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Alterar Motoristas / Camiões</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Se tiver um motorista atribuído e o trocar no menu suspenso e clique "SEND", o motorista removido receberá imediatamente uma notificação de <span className="text-red-600">"A atribuição do despacho não está mais disponível"</span>, e o novo motorista receberá uma notificação de <span className="text-emerald-600">"Despacho atribuído: Você foi designado para um despacho."</span>.
                </li>
              </ul>
              <p className="pl-5 text-sm text-slate-500 italic leading-6">
                Exemplo: Trocar Motorista 1 por Motorista 2 e clique "SEND"<br />
                Motorista 1 = notificação de <span className="text-red-600">"A atribuição do despacho não está mais disponível"</span><br />
                Motorista 2 = notificação de <span className="text-emerald-600">"Você foi designado para um despacho"</span>
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Se alterar um camião que já tem um motorista atribuído, a atribuição será <span className="font-medium">REINICIADA</span> e o motorista receberá uma notificação de <span className="text-red-600">"A atribuição do despacho não está mais disponível"</span>. Deixará de conseguir ver o despacho.
                </li>
              </ul>
              <p className="pl-5 text-sm text-slate-500 italic leading-6">
                Exemplo:<br />
                Camião 1 (com Motorista 1 atribuído) é alterado para Camião 2 (sem despacho):<br />
                A atribuição é <span className="font-medium">REINICIADA</span> (motorista removido), pelo que o Motorista 1 receberá uma notificação de <span className="text-red-600">"A atribuição do despacho não está mais disponível"</span>.<br />
                Reatribua-o ao Camião 2 e clique "SEND" para enviar uma nova notificação de <span className="text-emerald-600">"Você foi designado para um despacho"</span>, ou selecione outro motorista.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Se trocar camiões que já têm motoristas atribuídos, ambas as atribuições serão <span className="font-medium">REINICIADAS</span> e ambos os motoristas receberão uma notificação de <span className="text-red-600">"A atribuição do despacho não está mais disponível"</span>. Deixarão de conseguir ver os despachos até serem novamente atribuídos e clique "SEND".
                </li>
              </ul>
              <p className="pl-5 text-sm text-slate-500 italic leading-6">
                Exemplo:<br />
                Camião 1 com Motorista 1 é trocado com Camião 2 com Motorista 2:<br />
                Ambos os camiões terão os motoristas removidos, e ambos receberão uma notificação de <span className="text-red-600">"A atribuição do despacho não está mais disponível"</span>.<br />
                Reatribua-os e clique "SEND" para enviar novos <span className="text-emerald-600">"Você foi designado para um despacho"</span>.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Por favor, verifique sempre cuidadosamente todas as seleções e alterações efetuadas e confirme que os motoristas estão atribuídos e clique "SEND" ao despacho correto após qualquer troca de camiões.
                </li>
                <li>
                  Ainda é sua responsabilidade entrar em contato com seus motoristas para confirmar, verbalmente ou por escrito, que eles receberam o despacho correto e entenderam a tarefa.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Notificações Passivas do Motorista</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-6 text-slate-700">
                <li>
                  Se <span className="font-medium">selecionar um motorista e clique "SEND" e não fizer mais nada</span>, ele receberá notificações e atualizações de despachos da mesma forma que você, mas apenas relacionadas com os despachos aos quais está <span className="font-medium">atribuído</span>.
                </li>
                <li>
                  O que vê no seu ecrã corresponde exatamente ao estado atual. Se um motorista estiver atribuído a um despacho, ele também consegue vê-lo. <br />
                  Se aparecer <span className="font-medium">“Sem motorista selecionado”</span> no despacho, então o motorista não consegue ver esse despacho.
                </li>
              </ul>
            </section>
          </>
        }
      </CardContent>
    </Card>);

}