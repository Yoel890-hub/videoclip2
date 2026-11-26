import type { Metadata } from "next";
import LegalPage, { Contact, Section } from "@/components/LegalPage";
import { PAID_PLANS, PLANS, RETENTION_DAYS, TRIALS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de ClipLive: cuentas, planes, pagos, créditos y uso permitido.",
  alternates: { canonical: "/terminos" },
};

const every = (m: number) => (m === 1 ? "cada mes" : m === 12 ? "cada año" : `cada ${m} meses`);

export default function Terminos() {
  return (
    <LegalPage title="Términos y condiciones">
      <p>
        Estos términos regulan el uso de ClipLive (el «servicio»), disponible en este sitio web. Al crear una cuenta o usar el
        servicio aceptas estos términos y nuestra <a className="text-accent hover:underline" href="/privacidad">Política de privacidad</a>.
        Si no estás de acuerdo, no uses el servicio.
      </p>

      <Section n={1} title="Qué es ClipLive">
        <p>
          ClipLive es una herramienta que, a partir del enlace de un directo o vídeo público (YouTube, Twitch, Kick o TikTok) o de un
          archivo que subas, crea clips cortos, con opción de formato vertical, encuadre automático y subtítulos generados de forma automática.
          Los subtítulos y la elección de momentos se hacen con procesos automáticos y pueden contener errores.
        </p>
      </Section>

      <Section n={2} title="Tu cuenta">
        <ul className="list-disc space-y-1 pl-5">
          <li>Debes tener al menos 13 años para usar ClipLive y ser mayor de edad (o contar con permiso de tu padre, madre o tutor) para contratar un plan de pago.</li>
          <li>Eres responsable de mantener segura tu contraseña y de todo lo que se haga con tu cuenta.</li>
          <li>La información que nos des debe ser verdadera. Una cuenta es personal: no la compartas ni la vendas.</li>
        </ul>
      </Section>

      <Section n={3} title="Uso permitido y derechos de autor">
        <ul className="list-disc space-y-1 pl-5">
          <li>Solo puedes recortar contenido que te pertenezca o que tengas derecho a usar (por ejemplo, tus propios directos o contenido con permiso de su autor).</li>
          <li>Eres el único responsable de los clips que crees y de cómo los publiques, y debes respetar los derechos de autor y las condiciones de cada plataforma.</li>
          <li>No está permitido usar ClipLive para contenido ilegal, que acose o dañe a otras personas, ni intentar saturar, engañar o atacar el servicio.</li>
          <li>Si recibimos una reclamación justificada o detectamos un uso indebido, podemos borrar el contenido y suspender o cerrar la cuenta.</li>
        </ul>
      </Section>

      <Section n={4} title="Prueba gratis, planes y créditos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Las cuentas nuevas tienen {TRIALS} clips de prueba gratis, con los límites del modo prueba.</li>
          <li>
            Planes disponibles (precios en dólares estadounidenses):{" "}
            {PAID_PLANS.map((k, i) => <span key={k}>{i ? ", " : ""}{PLANS[k].name} ${PLANS[k].price} {every(PLANS[k].months)}</span>)}.
            Cada plan tiene sus propios límites de calidad, duración y clips a la vez, indicados en la página de planes.
          </li>
          <li>
            Cada clip gasta créditos según su calidad y duración. Los créditos se recargan cada semana, el mismo día de la semana en que
            se pagó el plan, hasta el tope semanal de tu plan. Los créditos que no uses no se acumulan de una semana a otra y no tienen
            valor en dinero, no se pueden transferir ni canjear.
          </li>
          <li>Si un clip falla por un problema nuestro, te devolvemos automáticamente los créditos o la prueba usados.</li>
        </ul>
      </Section>

      <Section n={5} title="Pagos, renovación y cancelación">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Los pagos en línea se procesan a través de PayPal como suscripción con <b>renovación automática</b>: se cobra el mismo importe
            al terminar cada periodo hasta que la canceles. ClipLive no recibe ni guarda los datos de tu tarjeta.
          </li>
          <li>
            Puedes cancelar cuando quieras desde la página de planes. Al cancelar se detienen los cobros siguientes y el plan se
            desactiva; la cuenta vuelve al modo prueba.
          </li>
          <li>
            También se pueden pagar planes en efectivo directamente con ClipLive. En ese caso el plan dura el tiempo pagado y vuelve
            al modo prueba al vencer, salvo que se renueve.
          </li>
          <li>
            Como el servicio y los créditos están disponibles de inmediato, los pagos no son reembolsables, salvo cuando lo exija la ley
            o en casos de cobros duplicados o errores nuestros. Si crees que hubo un error, contáctanos en un plazo de 14 días.
          </li>
          <li>Podemos cambiar precios o planes; los cambios no afectarán a un periodo ya pagado y te avisaremos antes de que se apliquen a tus renovaciones.</li>
        </ul>
      </Section>

      <Section n={6} title="Tus clips">
        <p>
          Los clips que crees se guardan durante {RETENTION_DAYS} días para que puedas descargarlos; después se borran automáticamente.
          Te recomendamos descargarlos a tiempo. Los archivos originales que subas se borran en cuanto se crea el clip.
        </p>
      </Section>

      <Section n={7} title="Disponibilidad del servicio">
        <p>
          Hacemos lo posible para que ClipLive funcione siempre, pero puede haber interrupciones, mantenimientos o fallos, y depende de
          plataformas externas (YouTube, Twitch, Kick, TikTok, PayPal) que pueden cambiar o bloquear el acceso en cualquier momento.
          No garantizamos que todos los enlaces o directos se puedan procesar.
        </p>
      </Section>

      <Section n={8} title="Responsabilidad">
        <p>
          El servicio se ofrece «tal cual». En la medida que permita la ley, ClipLive no se hace responsable de daños indirectos, pérdida
          de beneficios, de datos o de oportunidades, ni del uso que hagas de tus clips. En cualquier caso, nuestra responsabilidad
          total se limita a lo que hayas pagado en los últimos 3 meses.
        </p>
      </Section>

      <Section n={9} title="Cierre de la cuenta">
        <p>
          Puedes dejar de usar ClipLive cuando quieras y pedirnos que borremos tu cuenta. Podemos suspender o cerrar cuentas que
          incumplan estos términos.
        </p>
      </Section>

      <Section n={10} title="Cambios y ley aplicable">
        <p>
          Podemos actualizar estos términos; publicaremos la nueva versión en esta página con su fecha. Si el cambio es importante, te
          avisaremos. Estos términos se rigen por las leyes de la República Dominicana.
        </p>
      </Section>

      <Section n={11} title="Contacto">
        <p>Para cualquier duda, reclamación o solicitud, escríbenos a <Contact />.</p>
      </Section>
    </LegalPage>
  );
}
