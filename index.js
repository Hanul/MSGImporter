module.exports = (sourceFolderPath, saveFilePath, langs) => {
	
	let Path = require('path');
	
	let injectSentences = [];
	
	let cleanSentence = (sentence) => {
		
		if (sentence[0] === '\'') {
			sentence = sentence.substring(1, sentence.length);
		}
		if (sentence[sentence.length - 1] === '\'') {
			sentence = sentence.substring(0, sentence.length - 1);
		}
		
		let isStartString = true;
		let isInString;
		
		for (i = 0; i < sentence.length; i += 1) {
			if (sentence[i] === '\'') {
				
				if (sentence[i - 1] === '+' || sentence[i - 2] === '+') {
					if (isInString === undefined) {
						isStartString = false;
						isInString = true
					} else {
						isInString = !isInString;
					}
				}
				
				else if (sentence[i + 1] === '+' || sentence[i + 2] === '+') {
					if (isInString === undefined) {
						isInString = false
					} else {
						isInString = !isInString;
					}
				}
				
				else {
					sentence = sentence.substring(0, i) + '\\' + sentence.substring(i);
					i += 1;
				}
			}
		}
		
		if (isInString === undefined) {
			isInString = true;
		}
		
		if (isStartString === true) {
			sentence = '\'' + sentence;
		}
		if (isInString === true) {
			sentence = sentence + '\'';
		}
		
		return sentence;
	};
	
	READ_FILE({
		path: saveFilePath,
		isSync: true
	}, (content) => {
		content = content.toString();
		
		if (Path.extname(saveFilePath) === '.csv') {
			
			EACH(content.split('\n'), (text) => {
				text = text.trim();
				
				if (text !== '') {
					let data = {};
					
					let isInSentence = false;
					let sentenceStartIndex = 0;
					let sentenceCount = 0;
					
					EACH(text + ',', (c, i) => {
						if (c === '"' && text[i - 1] !== '"') {
							isInSentence = !isInSentence;
						}
						if (isInSentence !== true && c === ',') {
							if (sentenceCount > 0) {
								let sentence = text.substring(sentenceStartIndex, i);
								if (sentence[0] === '"' && sentence[sentence.length - 1] === '"') {
									sentence = sentence.substring(1, sentence.length - 1);
								}
								data[langs[sentenceCount - 1]] = cleanSentence(sentence);
							}
							sentenceStartIndex = i + 1;
							sentenceCount += 1;
						}
					});
					
					injectSentences.push(data);
				}
			});
		}
		
		else {
			
			EACH(content.split('\n'), (text) => {
				text = text.trim();
				
				if (text !== '') {
					let data = {};
					EACH(text.split('\t'), (sentence, i) => {
						data[langs[i]] = cleanSentence(sentence);
					});
					injectSentences.push(data);
				}
			});
		}
	});
	
	let find = (path) => {
		
		READ_FILE({
			path : path,
			isSync : true
		}, (content) => {
			content = content.toString();
			
			let length = content.length;
			let i, j, blockLevel, startIndex;
			
			for (i = 5; i < length; i += 1) {
				if (content.substring(i - 5, i) === 'MSG({') {
					
					tabCount = 0;
					startIndex = -1;
					for (j = i; j < length; j += 1) {
						if (content.substring(j - 5, j) === 'ko : ') {
							startIndex = j;
							for (let k = j; k >= 0; k -= 1) {
								if (content[k] === '\n') {
									break;
								}
								if (content[k] === '\t') {
									tabCount += 1;
								}
							}
						} else if (startIndex !== -1 && (content[j] === '\r' || content[j] === '\n')) {
	
							let isFound = false;
							let sentence = content.substring(startIndex, j).replace(/\t/g, '\\t');
							
							EACH(injectSentences, (info) => {
								if (sentence === info.ko) {
									
									// 영문 먼저 등록
									if (info.en !== undefined) {
										
										let append = '\r\n';
										for (let k = 0; k < tabCount; k += 1) {
											append += '\t'
										}
										append += 'en : ' + info.en.replace(/\\t/g, '\t') + ',';
		
										content = content.substring(0, i) + append + content.substring(i, length);
		
										i += append.length;
										j += append.length;
										startIndex += append.length;
										length += append.length;
									}
									
									// 이후 차례대로
									EACH(langs, (lang) => {
										if (lang !== 'en' && lang !== 'ko' && info[lang] !== undefined) {
											
											let append = ',\r\n';
											for (let k = 0; k < tabCount; k += 1) {
												append += '\t'
											}
											append += lang + ' : ' + info[lang].replace(/\\t/g, '\t');
			
											content = content.substring(0, j) + append + content.substring(j, length);
			
											i += append.length;
											j += append.length;
											startIndex += append.length;
											length += append.length;
										}
									});
	
									isFound = true;
									return false;
								}
							});
	
							if (isFound !== true) {
								console.log('다음 문장의 번역을 찾을 수 없음:', sentence);
							}
	
							break;
						}
					}
				}
			}
	
			WRITE_FILE({
				path : path,
				isSync : true,
				content : content
			});
		});
	};
	
	let scan = (path) => {
	
		FIND_FILE_NAMES({
			path : path,
			isSync : true
		}, (fileNames) => {
			EACH(fileNames, (fileName) => {
				find(path + '/' + fileName);
			});
		});
	
		FIND_FOLDER_NAMES({
			path : path,
			isSync : true
		}, (folderNames) => {
			EACH(folderNames, (folderName) => {
				scan(path + '/' + folderName);
			});
		});
	};
	
	scan(sourceFolderPath);
	
	console.log('삽입 완료');
};