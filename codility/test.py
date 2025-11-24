import sys
def solution(S):
    stack = []
    matching = {')':'(',']':'[','}':'{'}
    for c in S:
        if c in '([{':
            print('Append stack with ' + c)
            stack.append(c)
        else:
            print('Compare ' + c + '-->' + matching[c])
            if not stack or stack.pop() != matching[c]:
                print('correct')
                return 0
        if not stack:
            print('correct')
            return 1
        else:
            print('IN correct')
            return 0

solution('{[()]}')