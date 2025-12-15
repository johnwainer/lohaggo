import Link from 'next/link'

interface TermsCheckboxProps {
    checked: boolean
    onChange: (checked: boolean) => void
    required?: boolean
}

export default function TermsCheckbox({ checked, onChange, required = true }: TermsCheckboxProps) {
    return (
        <div className="pt-4 border-t border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onChange(e.target.checked)}
                        className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer checked:bg-primary-500 checked:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
                        required={required}
                    />
                </div>
                <span className="text-sm text-gray-700 leading-relaxed">
                    He leído y acepto los{' '}
                    <Link
                        href="/terms"
                        target="_blank"
                        className="text-primary-600 font-semibold hover:underline"
                    >
                        Términos y Condiciones
                    </Link>
                    , la{' '}
                    <Link
                        href="/privacy"
                        target="_blank"
                        className="text-primary-600 font-semibold hover:underline"
                    >
                        Política de Privacidad
                    </Link>
                    {' '}y la{' '}
                    <Link
                        href="/cookies"
                        target="_blank"
                        className="text-primary-600 font-semibold hover:underline"
                    >
                        Política de Cookies
                    </Link>
                    .
                </span>
            </label>
            <p className="mt-2 text-xs text-gray-500 ml-8">
                Al continuar, confirmas que has leído, entendido y aceptado nuestras políticas.
            </p>
        </div>
    )
}
