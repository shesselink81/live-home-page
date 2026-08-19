interface Props {
  title: string
  html: string
}

const PROSE_CLASSES = [
  '[&_h2]:text-white [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:first:mt-0',
  '[&_h3]:text-gray-200 [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mt-5 [&_h3]:mb-2',
  '[&_p]:text-gray-300 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1',
  '[&_li]:text-gray-300 [&_li]:text-sm',
  '[&_strong]:text-white [&_strong]:font-medium',
  '[&_em]:text-gray-500',
  '[&_a]:text-blue-400 [&_a]:hover:underline',
  '[&_code]:bg-gray-800 [&_code]:text-cyan-300 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs',
  '[&_table]:w-full [&_table]:text-sm [&_table]:my-2',
  '[&_th]:text-left [&_th]:text-gray-500 [&_th]:font-normal [&_th]:border-b [&_th]:border-gray-800 [&_th]:py-2 [&_th]:pr-3',
  '[&_td]:text-gray-300 [&_td]:border-b [&_td]:border-gray-800/50 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top',
  '[&_figure]:overflow-x-auto [&_figure]:mb-4',
].join(' ')

export default function StaticPageTab({ title, html }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">{title}</p>
      <div className={PROSE_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
