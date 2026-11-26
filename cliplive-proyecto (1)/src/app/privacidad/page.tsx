import type { Metadata } from "next";
import LegalPage, { Contact, Section } from "@/components/LegalPage";
import { RETENTION_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos recoge ClipLive, para qué los usa, con quién los comparte y cuáles son tus derechos.",
  alternates: { canonical: "/privacidad" },
};

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        En ClipLive solo usamos tus datos para que el servicio funcione. Esta política explica qué datos recogemos, para qué, con quién
        los compartimos y cómo puedes ejercer tus derechos, de acuerdo con la Ley 172-13 de la República Dominicana sobre protección de
        datos personales.
      </p>

      <Section n={1} title="Qué datos recogemos">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Cuenta:</b> tu correo o nombre de usuario y tu contraseña (que se guarda cifrada; nadie, ni nosotros, puede verla).</li>
          <li><b>Uso del servicio:</b> tu plan, tus créditos, los enlaces que pegas, las opciones de cada clip y los clips que se generan.</li>
          <li><b>Archivos que subes:</b> los vídeos originales que decides subir para recortarlos.</li>
          <li>
            <b>Pagos:</b> si pagas con PayPal, recibimos de PayPal el identificador de la suscripción, el plan, el importe y la fecha.
            <b> No recibimos ni guardamos los datos de tu tarjeta ni de tu cuenta de PayPal.</b> Si pagas en efectivo, guardamos el plan y su vencimiento.
          </li>
          <li><b>Datos técnicos:</b> dirección IP, navegador y fecha de las visitas, que nuestros proveedores registran por seguridad y para que la web funcione.</li>
        </ul>
      </Section>

      <Section n={2} title="Para qué los usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Crear y mantener tu cuenta e iniciar sesión.</li>
          <li>Crear tus clips (descargar el contenido del enlace, recortarlo, generar subtítulos y encuadrar).</li>
          <li>Gestionar tu plan, tus créditos y tus pagos.</li>
          <li>Proteger el servicio frente a abusos y fraudes, y cumplir con la ley.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad. No mostramos anuncios.</p>
      </Section>

      <Section n={3} title="Con quién los compartimos">
        <p>Solo con los proveedores que necesitamos para dar el servicio, que tratan los datos por nuestra cuenta:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Supabase:</b> base de datos, inicio de sesión y almacenamiento de los clips.</li>
          <li><b>Render</b> y <b>Cloudflare:</b> servidores donde funciona la web y protección de la conexión.</li>
          <li><b>PayPal:</b> cobro de las suscripciones (con su propia política de privacidad).</li>
          <li><b>Google:</b> solo si eliges entrar con tu cuenta de Google, y para que la web aparezca en sus búsquedas.</li>
        </ul>
        <p>
          Algunos de estos proveedores están fuera de la República Dominicana (por ejemplo, en Estados Unidos). También podemos
          compartir datos si una autoridad lo exige legalmente.
        </p>
      </Section>

      <Section n={4} title="Cuánto tiempo los guardamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Los clips se borran automáticamente a los {RETENTION_DAYS} días.</li>
          <li>Los vídeos originales que subes se borran en cuanto se crea el clip.</li>
          <li>Los datos de la cuenta se guardan mientras la cuenta exista. Si pides borrarla, los eliminamos, salvo los datos de pagos que la ley obligue a conservar.</li>
        </ul>
      </Section>

      <Section n={5} title="Cookies">
        <p>
          Usamos solo las cookies necesarias para mantener tu sesión iniciada y que la web funcione. No usamos cookies de publicidad ni
          de seguimiento de terceros. PayPal puede usar sus propias cookies al mostrar sus botones de pago.
        </p>
      </Section>

      <Section n={6} title="Seguridad">
        <p>
          Las conexiones van cifradas (HTTPS), las contraseñas se guardan cifradas y los clips están en un almacenamiento privado al que
          solo se accede con enlaces temporales. Ningún sistema es 100 % seguro: si detectamos un problema que afecte a tus datos, te avisaremos.
        </p>
      </Section>

      <Section n={7} title="Tus derechos">
        <p>
          Puedes pedirnos en cualquier momento <b>ver</b> tus datos, <b>corregirlos</b>, <b>borrarlos</b> (y con ellos tu cuenta) u
          <b> oponerte</b> a un uso concreto. Escríbenos a <Contact /> desde el correo de tu cuenta (o indicando tu usuario) y te
          responderemos en un plazo máximo de 30 días.
        </p>
      </Section>

      <Section n={8} title="Menores">
        <p>ClipLive no está dirigido a menores de 13 años. Si sabemos que una cuenta pertenece a un menor de esa edad, la borraremos.</p>
      </Section>

      <Section n={9} title="Cambios">
        <p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha y, si el cambio es importante, te avisaremos.</p>
      </Section>
    </LegalPage>
  );
}
