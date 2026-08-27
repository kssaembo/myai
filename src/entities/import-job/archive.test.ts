import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { describe, expect, it } from 'vitest'

import { ArchiveValidationError, normalizeSafePath, prepareArchive, prepareFiles } from './archive'

if (!Blob.prototype.stream) {
  Blob.prototype.stream = function stream() {
    const buffer = this.arrayBuffer()
    return new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        void buffer.then((value) => {
          controller.enqueue(new Uint8Array(value))
          controller.close()
        })
      },
    })
  }
}

describe('batch import archive safety', () => {
  it('rejects traversal and absolute ZIP paths', () => {
    for (const path of ['../secret.md', 'safe/../../secret.md', '/root.md', 'C:\\secret.md']) {
      expect(() => normalizeSafePath(path)).toThrow(ArchiveValidationError)
    }
    expect(normalizeSafePath('./docs/ref.md')).toBe('docs/ref.md')
  })

  it('keeps unsupported direct files as skipped candidates', () => {
    const prepared = prepareFiles([
      new File(['# 문서'], 'REF_GAME.md', { type: 'text/markdown' }),
      new File(['image'], 'cover.png', { type: 'image/png' }),
    ])
    expect(prepared.candidates.map((candidate) => candidate.format)).toEqual(['md', null])
  })

  it('reads supported files lazily from a valid ZIP', async () => {
    const writer = new ZipWriter(new BlobWriter('application/zip'))
    await writer.add('refs/REF_SECRET.md', new TextReader('# 비밀 숫자'))
    await writer.add('assets/cover.png', new TextReader('not imported'))
    const blob = await writer.close()
    const prepared = await prepareArchive(
      new File([blob], 'classroom.zip', { type: 'application/zip' }),
      true,
    )

    expect(prepared.importType).toBe('ref_zip')
    expect(prepared.candidates).toHaveLength(2)
    const markdown = prepared.candidates.find((candidate) => candidate.format === 'md')
    expect(markdown?.relativePath).toBe('refs/REF_SECRET.md')
    expect(await (await markdown?.loadFile())?.text()).toBe('# 비밀 숫자')
    await prepared.dispose()
  })
})
